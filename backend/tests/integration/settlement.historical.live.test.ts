import path from 'path';
import { describe, expect, it } from 'vitest';
import dotenv from 'dotenv';
import { apiFootball } from '../../src/services/apiFootball';
import {
  resolveSelectionOutcome,
  type FixtureSettlementContext,
  type SelectionSettlementInput,
} from '../../src/services/settlementResolver';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const shouldRunHistoricalSettlement =
  process.env.RUN_LIVE_TESTS === '1' &&
  Boolean(process.env.API_FOOTBALL_KEY) &&
  Boolean(process.env.TEST_SEASON);

type FixtureRow = {
  fixture?: {
    id?: number;
    status?: { short?: string };
  };
  goals?: { home?: number | null; away?: number | null };
  score?: {
    halftime?: { home?: number | null; away?: number | null };
    fulltime?: { home?: number | null; away?: number | null };
    extratime?: { home?: number | null; away?: number | null };
    penalty?: { home?: number | null; away?: number | null };
  };
  teams?: {
    home?: { id?: number; name?: string };
    away?: { id?: number; name?: string };
  };
};

type FixtureEventRow = {
  type?: string;
  detail?: string;
  team?: { id?: number; name?: string };
  player?: { id?: number; name?: string };
  time?: { elapsed?: number; extra?: number | null };
};

type FixtureStatisticsRow = {
  team?: { id?: number; name?: string };
  statistics?: Array<{ type?: string; value?: string | number | null }>;
};

type HistoricalCheck = {
  group: 'score' | 'events' | 'stats';
  label: string;
  selection: SelectionSettlementInput;
  context: FixtureSettlementContext;
  expected: 'won' | 'lost' | 'void';
};

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseLeagues = (): number[] => {
  const preferredRaw = process.env.TEST_SETTLEMENT_LEAGUES ?? process.env.TEST_LEAGUE_ID ?? '';
  const preferred = preferredRaw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
  const fallback = [39, 140, 78, 135, 61, 45];
  return Array.from(new Set([...preferred, ...fallback])).slice(0, 5);
};

const normalize = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const isGoalEvent = (event: FixtureEventRow): boolean => {
  const type = normalize(event.type);
  const detail = normalize(event.detail);
  return type === 'goal' || detail.includes('goal');
};

const isCardEvent = (event: FixtureEventRow): boolean => {
  const type = normalize(event.type);
  const detail = normalize(event.detail);
  return type === 'card' || detail.includes('card');
};

const getWinnerToken = (home: number, away: number): 'Home' | 'Away' | 'Draw' => {
  if (home > away) return 'Home';
  if (away > home) return 'Away';
  return 'Draw';
};

const getTeamStat = (
  context: FixtureSettlementContext,
  side: 'home' | 'away',
  labels: string[],
): number | null => {
  const teamId = side === 'home' ? toNumber(context.teams?.home?.id) : toNumber(context.teams?.away?.id);
  if (!teamId || !Array.isArray(context.statistics)) return null;

  const row = context.statistics.find((entry) => toNumber(entry.team?.id) === teamId);
  if (!row?.statistics) return null;

  for (const label of labels) {
    const stat = row.statistics.find((item) => normalize(item.type) === normalize(label));
    if (!stat) continue;
    if (typeof stat.value === 'number' && Number.isFinite(stat.value)) return stat.value;
    const parsed = String(stat.value ?? '').match(/\d+/);
    if (parsed) return Number(parsed[0]);
  }

  return null;
};

const buildChecksForContext = (
  context: FixtureSettlementContext,
): HistoricalCheck[] => {
  const fixtureId = context.fixtureId;
  const ftHome = toNumber(context.score?.fulltime?.home ?? context.goals?.home);
  const ftAway = toNumber(context.score?.fulltime?.away ?? context.goals?.away);
  if (ftHome === null || ftAway === null) return [];

  const checks: HistoricalCheck[] = [];
  const totalGoals = ftHome + ftAway;
  const htHome = toNumber(context.score?.halftime?.home);
  const htAway = toNumber(context.score?.halftime?.away);
  const shHome = htHome === null ? null : ftHome - htHome;
  const shAway = htAway === null ? null : ftAway - htAway;

  checks.push({
    group: 'score',
    label: 'match winner',
    context,
    selection: { fixtureId, marketName: 'Match Winner', value: getWinnerToken(ftHome, ftAway) },
    expected: 'won',
  });
  checks.push({
    group: 'score',
    label: 'double chance',
    context,
    selection: {
      fixtureId,
      marketName: 'Double Chance',
      value: ftHome >= ftAway ? 'Home/Draw' : 'Draw/Away',
    },
    expected: 'won',
  });
  checks.push({
    group: 'score',
    label: 'goals over/under over',
    context,
    selection: { fixtureId, marketName: 'Goals Over/Under', value: `Over ${Math.max(0, totalGoals - 0.5).toFixed(1)}` },
    expected: 'won',
  });
  checks.push({
    group: 'score',
    label: 'exact score',
    context,
    selection: { fixtureId, marketName: 'Exact Score', value: `${ftHome}:${ftAway}` },
    expected: 'won',
  });
  checks.push({
    group: 'score',
    label: 'exact goals number',
    context,
    selection: { fixtureId, marketName: 'Exact Goals Number', value: String(totalGoals) },
    expected: 'won',
  });
  checks.push({
    group: 'score',
    label: 'goal line',
    context,
    selection: { fixtureId, marketName: 'Goal Line', value: `Over ${Math.max(0, totalGoals - 0.5).toFixed(1)}` },
    expected: 'won',
  });
  checks.push({
    group: 'score',
    label: 'draw no bet home',
    context,
    selection: { fixtureId, marketName: 'Draw No Bet', value: 'Home' },
    expected: ftHome === ftAway ? 'void' : ftHome > ftAway ? 'won' : 'lost',
  });
  checks.push({
    group: 'score',
    label: 'both teams score',
    context,
    selection: { fixtureId, marketName: 'Both Teams Score', value: ftHome > 0 && ftAway > 0 ? 'Yes' : 'No' },
    expected: 'won',
  });
  checks.push({
    group: 'score',
    label: 'home team score a goal',
    context,
    selection: { fixtureId, marketName: 'Home Team Score a Goal', value: ftHome > 0 ? 'Yes' : 'No' },
    expected: 'won',
  });
  checks.push({
    group: 'score',
    label: 'away team score a goal',
    context,
    selection: { fixtureId, marketName: 'Away Team Score a Goal', value: ftAway > 0 ? 'Yes' : 'No' },
    expected: 'won',
  });

  if (htHome !== null && htAway !== null) {
    checks.push({
      group: 'score',
      label: 'first half winner',
      context,
      selection: { fixtureId, marketName: 'First Half Winner', value: getWinnerToken(htHome, htAway) },
      expected: 'won',
    });
    if (shHome !== null && shAway !== null) {
      checks.push({
        group: 'score',
        label: 'second half winner',
        context,
        selection: { fixtureId, marketName: 'Second Half Winner', value: getWinnerToken(shHome, shAway) },
        expected: 'won',
      });
      const bothHalvesGoal = htHome + htAway > 0 && shHome + shAway > 0;
      checks.push({
        group: 'score',
        label: 'to score in both halves',
        context,
        selection: {
          fixtureId,
          marketName: 'To Score in Both Halves',
          value: bothHalvesGoal ? 'Yes' : 'No',
        },
        expected: 'won',
      });

      const firstHalfTotal = htHome + htAway;
      const secondHalfTotal = shHome + shAway;
      const highestHalfValue =
        firstHalfTotal > secondHalfTotal
          ? '1st Half'
          : secondHalfTotal > firstHalfTotal
            ? '2nd Half'
            : 'Draw';
      checks.push({
        group: 'score',
        label: 'highest scoring half',
        context,
        selection: { fixtureId, marketName: 'Highest Scoring Half', value: highestHalfValue },
        expected: 'won',
      });
    }
  }

  if (ftHome !== ftAway) {
    const margin = Math.abs(ftHome - ftAway);
    const marginValue = margin >= 4 ? '4+' : String(margin);
    checks.push({
      group: 'score',
      label: 'winning margin',
      context,
      selection: {
        fixtureId,
        marketName: 'Winning Margin',
        value: `${ftHome > ftAway ? '1' : '2'} by ${marginValue}`,
      },
      expected: 'won',
    });
    checks.push({
      group: 'score',
      label: 'home/away',
      context,
      selection: { fixtureId, marketName: 'Home/Away', value: ftHome > ftAway ? 'Home' : 'Away' },
      expected: 'won',
    });
  }

  const goalEvents = (context.events ?? [])
    .filter((event) => isGoalEvent(event as FixtureEventRow))
    .sort((a, b) => {
      const aElapsed = toNumber((a as FixtureEventRow).time?.elapsed) ?? 0;
      const bElapsed = toNumber((b as FixtureEventRow).time?.elapsed) ?? 0;
      return aElapsed - bElapsed;
    }) as FixtureEventRow[];
  const cardEvents = (context.events ?? []).filter((event) => isCardEvent(event as FixtureEventRow)) as FixtureEventRow[];
  const homeId = toNumber(context.teams?.home?.id);
  const awayId = toNumber(context.teams?.away?.id);

  if (goalEvents.length > 0 && homeId && awayId) {
    const firstGoal = goalEvents[0];
    const lastGoal = goalEvents[goalEvents.length - 1];
    const firstGoalSide =
      toNumber(firstGoal.team?.id) === homeId ? 'Home' : toNumber(firstGoal.team?.id) === awayId ? 'Away' : null;
    const lastGoalSide =
      toNumber(lastGoal.team?.id) === homeId ? 'Home' : toNumber(lastGoal.team?.id) === awayId ? 'Away' : null;

    if (firstGoalSide) {
      checks.push({
        group: 'events',
        label: 'team to score first',
        context,
        selection: { fixtureId, marketName: 'Team To Score First', value: firstGoalSide },
        expected: 'won',
      });
    }
    if (lastGoalSide) {
      checks.push({
        group: 'events',
        label: 'team to score last',
        context,
        selection: { fixtureId, marketName: 'Team To Score Last', value: lastGoalSide },
        expected: 'won',
      });
    }

    if (firstGoal.player?.name) {
      checks.push({
        group: 'events',
        label: 'anytime goalscorer',
        context,
        selection: { fixtureId, marketName: 'Anytime Goal Scorer', value: firstGoal.player.name },
        expected: 'won',
      });
      checks.push({
        group: 'events',
        label: 'first goalscorer',
        context,
        selection: { fixtureId, marketName: 'First Goal Scorer', value: firstGoal.player.name },
        expected: 'won',
      });
    }
    if (lastGoal.player?.name) {
      checks.push({
        group: 'events',
        label: 'last goalscorer',
        context,
        selection: { fixtureId, marketName: 'Last Goal Scorer', value: lastGoal.player.name },
        expected: 'won',
      });
    }
  }

  if (cardEvents.length > 0) {
    checks.push({
      group: 'events',
      label: 'total cards over',
      context,
      selection: { fixtureId, marketName: 'Cards Over/Under', value: 'Over 0.5' },
      expected: 'won',
    });
  }

  if (Array.isArray(context.events) && context.events.length > 0) {
    const hasOwnGoal = context.events.some((event) => normalize((event as FixtureEventRow).detail).includes('own goal'));
    checks.push({
      group: 'events',
      label: 'own goal yes/no',
      context,
      selection: { fixtureId, marketName: 'Own Goal', value: hasOwnGoal ? 'Yes' : 'No' },
      expected: 'won',
    });

    const hasPenalty = context.events.some((event) => {
      const detail = normalize((event as FixtureEventRow).detail);
      const type = normalize((event as FixtureEventRow).type);
      return detail.includes('penalty') || type.includes('penalty');
    });
    checks.push({
      group: 'events',
      label: 'penalty awarded yes/no',
      context,
      selection: { fixtureId, marketName: 'Penalty Awarded', value: hasPenalty ? 'Yes' : 'No' },
      expected: 'won',
    });
  }

  const homeCorners = getTeamStat(context, 'home', ['Corner Kicks']);
  const awayCorners = getTeamStat(context, 'away', ['Corner Kicks']);
  if (homeCorners !== null && awayCorners !== null) {
    const total = homeCorners + awayCorners;
    checks.push({
      group: 'stats',
      label: 'corners over/under',
      context,
      selection: {
        fixtureId,
        marketName: 'Corners Over Under',
        value: total === 0 ? 'Under 0.5' : `Over ${(total - 0.5).toFixed(1)}`,
      },
      expected: 'won',
    });
    checks.push({
      group: 'stats',
      label: 'corners 1x2',
      context,
      selection: {
        fixtureId,
        marketName: 'Corners 1x2',
        value: homeCorners > awayCorners ? 'Home' : awayCorners > homeCorners ? 'Away' : 'Draw',
      },
      expected: 'won',
    });
  }

  const homeOffsides = getTeamStat(context, 'home', ['Offsides']);
  const awayOffsides = getTeamStat(context, 'away', ['Offsides']);
  if (homeOffsides !== null && awayOffsides !== null) {
    checks.push({
      group: 'stats',
      label: 'offsides 1x2',
      context,
      selection: {
        fixtureId,
        marketName: 'Offsides 1x2',
        value: homeOffsides > awayOffsides ? 'Home' : awayOffsides > homeOffsides ? 'Away' : 'Draw',
      },
      expected: 'won',
    });
  }

  const homeShotsOnTarget = getTeamStat(context, 'home', [
    'Shots on Goal',
    'Shots On Goal',
    'Shots on Target',
  ]);
  const awayShotsOnTarget = getTeamStat(context, 'away', [
    'Shots on Goal',
    'Shots On Goal',
    'Shots on Target',
  ]);
  if (homeShotsOnTarget !== null && awayShotsOnTarget !== null) {
    checks.push({
      group: 'stats',
      label: 'shots on target 1x2',
      context,
      selection: {
        fixtureId,
        marketName: 'ShotOnTarget 1x2',
        value:
          homeShotsOnTarget > awayShotsOnTarget
            ? 'Home'
            : awayShotsOnTarget > homeShotsOnTarget
              ? 'Away'
              : 'Draw',
      },
      expected: 'won',
    });
  }

  return checks;
};

describe('settlement historical live replay', () => {
  it.runIf(shouldRunHistoricalSettlement)(
    'validates resolver outcomes across a broad historical pre-match market matrix',
    async () => {
      const season = Number(process.env.TEST_SEASON);
      const leagues = parseLeagues();
      expect(leagues.length).toBeGreaterThan(0);

      const fixtureRowsByLeague = await Promise.all(
        leagues.map(async (leagueId) => {
          const payload = await apiFootball.proxy<FixtureRow[]>('/fixtures', {
            league: leagueId,
            season,
            status: 'FT',
            last: 25,
          });
          return Array.isArray(payload.response) ? payload.response : [];
        }),
      );

      const baseFixtures = fixtureRowsByLeague
        .flat()
        .filter((row) => Number.isFinite(Number(row?.fixture?.id)) && Number(row?.fixture?.id) > 0)
        .slice(0, 14);
      expect(baseFixtures.length).toBeGreaterThanOrEqual(5);

      const allChecks: HistoricalCheck[] = [];
      for (const fixture of baseFixtures) {
        const fixtureId = Number(fixture.fixture?.id);
        const [eventsPayload, statsPayload] = await Promise.all([
          apiFootball.proxy<FixtureEventRow[]>('/fixtures/events', { fixture: fixtureId }).catch(() => ({
            response: [],
          })),
          apiFootball.proxy<FixtureStatisticsRow[]>('/fixtures/statistics', { fixture: fixtureId }).catch(() => ({
            response: [],
          })),
        ]);

        const context: FixtureSettlementContext = {
          fixtureId,
          statusShort: fixture.fixture?.status?.short ?? 'FT',
          teams: fixture.teams,
          goals: fixture.goals,
          score: fixture.score,
          events: Array.isArray(eventsPayload.response) ? eventsPayload.response : [],
          statistics: Array.isArray(statsPayload.response) ? statsPayload.response : [],
        };

        allChecks.push(...buildChecksForContext(context));
      }

      const dedupedChecks = Array.from(
        new Map(
          allChecks.map((check) => [
            `${check.group}|${check.selection.fixtureId}|${check.selection.marketName}|${check.selection.value}|${check.expected}`,
            check,
          ]),
        ).values(),
      );

      const scoreChecks = dedupedChecks.filter((check) => check.group === 'score');
      const eventChecks = dedupedChecks.filter((check) => check.group === 'events');
      const statsChecks = dedupedChecks.filter((check) => check.group === 'stats');

      expect(scoreChecks.length).toBeGreaterThanOrEqual(12);
      expect(eventChecks.length).toBeGreaterThanOrEqual(4);
      expect(statsChecks.length).toBeGreaterThanOrEqual(3);
      expect(dedupedChecks.length).toBeGreaterThanOrEqual(20);

      for (const check of dedupedChecks) {
        const resolved = resolveSelectionOutcome(check.selection, check.context);
        expect(
          resolved.outcome,
          `[${check.group}] ${check.label} fixture=${check.selection.fixtureId} market=${check.selection.marketName} value=${check.selection.value}`,
        ).toBe(check.expected);
      }
    },
    180000,
  );
});
