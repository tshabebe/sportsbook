import path from 'path';
import { describe, expect, it } from 'vitest';
import dotenv from 'dotenv';
import { apiFootball } from '../../src/services/apiFootball';
import {
  createBetWithSelections,
  createRetailTicketForBet,
  getRetailTicketByTicketId,
} from '../../src/services/db';
import { settleRetailTicketIfDecidable } from '../../src/services/retailSettlement';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const shouldRun =
  process.env.RUN_LIVE_TESTS === '1' &&
  Boolean(process.env.API_FOOTBALL_KEY) &&
  Boolean(process.env.DATABASE_URL) &&
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
  };
  teams?: {
    home?: { id?: number; name?: string };
    away?: { id?: number; name?: string };
  };
  league?: { id?: number; name?: string };
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

type MarketCatalogRow = {
  id?: number | string;
  name?: string;
  bet?: { id?: number | string; name?: string };
};

type TicketSelection = {
  fixtureId: number;
  betId: number;
  value: string;
  odd: number;
  bookmakerId: number;
  handicap?: number;
};

type LoadedFixture = {
  fixtureId: number;
  fixture: FixtureRow;
  events: FixtureEventRow[];
  statistics: FixtureStatisticsRow[];
  ftHome: number;
  ftAway: number;
  htHome: number | null;
  htAway: number | null;
  homeId: number | null;
  awayId: number | null;
  goalEvents: FixtureEventRow[];
  cardEvents: FixtureEventRow[];
};

const toNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const winnerToken = (home: number, away: number): 'Home' | 'Away' | 'Draw' => {
  if (home > away) return 'Home';
  if (away > home) return 'Away';
  return 'Draw';
};

const seededIndex = (seed: number, size: number): number => {
  if (size <= 1) return 0;
  const next = Math.abs(Math.sin(seed) * 10000);
  return Math.floor(next) % size;
};

const parseLeagues = (): number[] => {
  const preferredRaw = process.env.TEST_SETTLEMENT_LEAGUES ?? process.env.TEST_LEAGUE_ID ?? '';
  const preferred = preferredRaw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);

  const fallback = [39, 140, 78, 45];
  const merged = Array.from(new Set([...preferred, ...fallback]));
  return merged.slice(0, 4);
};

const normalize = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientDbNetworkError = (error: unknown): boolean => {
  const err = error as any;
  const text = [
    String(error ?? ''),
    String(err?.message ?? ''),
    String(err?.cause?.message ?? ''),
    String(err?.cause?.code ?? ''),
    Array.isArray(err?.cause?.errors)
      ? err.cause.errors.map((entry: any) => `${entry?.code ?? ''} ${entry?.message ?? ''}`).join(' ')
      : '',
  ]
    .join(' ')
    .toLowerCase();
  return (
    text.includes('fetch failed') ||
    text.includes('etimedout') ||
    text.includes('enetunreach') ||
    text.includes('error connecting to database')
  );
};

const withDbRetry = async <T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 6,
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientDbNetworkError(error) || attempt === attempts) {
        throw error;
      }
      console.warn(
        `[retailSettlement.historical] transient DB failure during ${label}, retry ${attempt}/${attempts}`,
      );
      await sleep(1200 * attempt);
    }
  }
  throw lastError;
};

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

const findMarketId = (
  markets: MarketCatalogRow[],
  matchers: string[],
): number => {
  const row = markets.find((entry) => {
    const name = String(entry?.name ?? entry?.bet?.name ?? '').toLowerCase().trim();
    return matchers.some((fragment) => name.includes(fragment));
  });
  const id = Number(row?.id ?? row?.bet?.id);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error(`Market not found for fragments: ${matchers.join(', ')}`);
  }
  return id;
};

const findOptionalMarketId = (
  markets: MarketCatalogRow[],
  matchers: string[],
): number | null => {
  try {
    return findMarketId(markets, matchers);
  } catch {
    return null;
  }
};

const getTeamStat = (
  fixture: LoadedFixture,
  side: 'home' | 'away',
  labels: string[],
): number | null => {
  const teamId = side === 'home' ? fixture.homeId : fixture.awayId;
  if (!teamId) return null;
  const row = fixture.statistics.find((entry) => toNumber(entry.team?.id) === teamId);
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

const loadFixtures = async (
  season: number,
  leagues: number[],
  seed: number,
): Promise<LoadedFixture[]> => {
  const fixtureRowsByLeague = await Promise.all(
    leagues.map(async (leagueId, index) => {
      const payload = await apiFootball.proxy<FixtureRow[]>('/fixtures', {
        league: leagueId,
        season,
        status: 'FT',
        last: 25,
      });
      const rows = Array.isArray(payload.response) ? payload.response : [];
      return rows
        .filter((row) => {
          const fixtureId = Number(row?.fixture?.id);
          const home = toNumber(row?.score?.fulltime?.home ?? row?.goals?.home);
          const away = toNumber(row?.score?.fulltime?.away ?? row?.goals?.away);
          return Number.isFinite(fixtureId) && fixtureId > 0 && home !== null && away !== null;
        })
        .slice(0, 8)
        .map((row, rowIndex) => ({ row, order: seededIndex(seed + index * 31 + rowIndex * 7, 1000) }));
    }),
  );

  const orderedFixtures = fixtureRowsByLeague
    .flat()
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.row);

  const loaded: LoadedFixture[] = [];
  for (const fixture of orderedFixtures.slice(0, 12)) {
    const fixtureId = Number(fixture.fixture?.id);
    const [eventsPayload, statsPayload] = await Promise.all([
      apiFootball.proxy<FixtureEventRow[]>('/fixtures/events', { fixture: fixtureId }).catch(() => ({
        response: [],
      })),
      apiFootball.proxy<FixtureStatisticsRow[]>('/fixtures/statistics', { fixture: fixtureId }).catch(() => ({
        response: [],
      })),
    ]);

    const events = Array.isArray(eventsPayload.response) ? eventsPayload.response : [];
    const statistics = Array.isArray(statsPayload.response) ? statsPayload.response : [];
    const ftHome = Number(fixture.score?.fulltime?.home ?? fixture.goals?.home ?? 0);
    const ftAway = Number(fixture.score?.fulltime?.away ?? fixture.goals?.away ?? 0);
    const htHome = toNumber(fixture.score?.halftime?.home);
    const htAway = toNumber(fixture.score?.halftime?.away);
    const homeId = toNumber(fixture.teams?.home?.id);
    const awayId = toNumber(fixture.teams?.away?.id);

    loaded.push({
      fixtureId,
      fixture,
      events,
      statistics,
      ftHome,
      ftAway,
      htHome,
      htAway,
      homeId,
      awayId,
      goalEvents: events.filter(isGoalEvent),
      cardEvents: events.filter(isCardEvent),
    });
  }

  return loaded;
};

const settleTicketAndAssert = async (input: {
  ticketId: string;
  stake: number;
  selections: TicketSelection[];
  expectedOutcome: 'won' | 'lost';
}) => {
  const betRef = `${input.ticketId.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
  const betId = await withDbRetry(
    `createBetWithSelections:${input.ticketId}`,
    () =>
      createBetWithSelections(
        betRef,
        {
          mode: 'multiple',
          stake: input.stake,
          selections: input.selections,
        },
        {},
        'pending',
        undefined,
        { channel: 'online_retail_ticket', ticketId: input.ticketId },
      ),
  );

  expect(betId).toBeTruthy();
  if (!betId) return;

  await withDbRetry(
    `createRetailTicketForBet:${input.ticketId}`,
    () => createRetailTicketForBet({ ticketId: input.ticketId, betId }),
  );
  const settlement = await withDbRetry(
    `settleRetailTicketIfDecidable:${input.ticketId}`,
    () => settleRetailTicketIfDecidable(input.ticketId),
  );

  expect(settlement.settled).toBe(true);
  expect(settlement.outcome).toBe(input.expectedOutcome);
  if (input.expectedOutcome === 'won') {
    const expectedPayout = Number(
      (
        input.stake *
        input.selections.reduce((acc, selection) => acc * selection.odd, 1)
      ).toFixed(2),
    );
    expect(settlement.payout).toBeCloseTo(expectedPayout, 2);
  } else {
    expect(Number(settlement.payout ?? 0)).toBe(0);
  }

  const ticket = await withDbRetry(
    `getRetailTicketByTicketId:${input.ticketId}`,
    () => getRetailTicketByTicketId(input.ticketId),
  );
  if (input.expectedOutcome === 'won') {
    expect(ticket?.status).toBe('settled_won_unpaid');
    expect(ticket?.bet.status).toBe('won');
  } else {
    expect(ticket?.status).toBe('settled_lost');
    expect(ticket?.bet.status).toBe('lost');
  }
};

describe('retail settlement historical live', () => {
  it.runIf(shouldRun)(
    'settles historical retail tickets across score, event, and stats market families',
    async () => {
      const season = Number(process.env.TEST_SEASON);
      const leagues = parseLeagues();
      const seed = Number(process.env.TEST_SETTLEMENT_SEED ?? '42');

      expect(leagues.length).toBeGreaterThanOrEqual(2);

      const marketPayload = await apiFootball.proxy<MarketCatalogRow[]>('/odds/bets');
      const marketRows = Array.isArray(marketPayload.response) ? marketPayload.response : [];
      expect(marketRows.length).toBeGreaterThan(0);

      const marketIds = {
        matchWinner: findMarketId(marketRows, ['match winner']),
        doubleChance: findMarketId(marketRows, ['double chance']),
        goalsOverUnder: findMarketId(marketRows, ['goals over/under']),
        btts: findMarketId(marketRows, ['both teams score', 'both teams to score']),
        exactScore: findMarketId(marketRows, ['exact score']),
        firstHalfWinner: findOptionalMarketId(marketRows, ['first half winner']),
        teamToScoreFirst: findMarketId(marketRows, ['team to score first', 'first team to score']),
        teamToScoreLast: findMarketId(marketRows, ['team to score last', 'last team to score']),
        cardsOverUnder: findMarketId(marketRows, ['cards over/under']),
        anytimeGoalScorer: findOptionalMarketId(marketRows, ['anytime goal scorer']),
        cornersOverUnder: findMarketId(marketRows, ['corners over under', 'corners over/under']),
        corners1x2: findMarketId(marketRows, ['corners 1x2']),
        offsides1x2: findOptionalMarketId(marketRows, ['offsides 1x2']),
        shotOnTarget1x2: findOptionalMarketId(marketRows, ['shotontarget 1x2']),
      };

      const fixtures = await loadFixtures(season, leagues, seed);
      expect(fixtures.length).toBeGreaterThanOrEqual(4);

      const scoreFixture = fixtures.find((fixture) => Number.isFinite(fixture.ftHome) && Number.isFinite(fixture.ftAway));
      expect(scoreFixture).toBeTruthy();
      if (!scoreFixture) return;

      const eventFixture = fixtures.find(
        (fixture) =>
          fixture.goalEvents.length > 0 &&
          fixture.cardEvents.length > 0 &&
          fixture.homeId !== null &&
          fixture.awayId !== null,
      );
      expect(eventFixture).toBeTruthy();
      if (!eventFixture) return;

      const statsFixture = fixtures.find((fixture) => {
        const homeCorners = getTeamStat(fixture, 'home', ['Corner Kicks']);
        const awayCorners = getTeamStat(fixture, 'away', ['Corner Kicks']);
        return homeCorners !== null && awayCorners !== null;
      });
      expect(statsFixture).toBeTruthy();
      if (!statsFixture) return;

      const scoreTotal = scoreFixture.ftHome + scoreFixture.ftAway;
      const scoreSelections: TicketSelection[] = [
        {
          fixtureId: scoreFixture.fixtureId,
          betId: marketIds.matchWinner,
          value: winnerToken(scoreFixture.ftHome, scoreFixture.ftAway),
          odd: 1.34,
          bookmakerId: 8,
        },
        {
          fixtureId: scoreFixture.fixtureId,
          betId: marketIds.doubleChance,
          value:
            scoreFixture.ftHome >= scoreFixture.ftAway
              ? 'Home/Draw'
              : 'Draw/Away',
          odd: 1.21,
          bookmakerId: 8,
        },
        {
          fixtureId: scoreFixture.fixtureId,
          betId: marketIds.goalsOverUnder,
          value: `Over ${Math.max(0, scoreTotal - 0.5).toFixed(1)}`,
          odd: 1.39,
          bookmakerId: 8,
        },
        {
          fixtureId: scoreFixture.fixtureId,
          betId: marketIds.btts,
          value: scoreFixture.ftHome > 0 && scoreFixture.ftAway > 0 ? 'Yes' : 'No',
          odd: 1.47,
          bookmakerId: 8,
        },
        {
          fixtureId: scoreFixture.fixtureId,
          betId: marketIds.exactScore,
          value: `${scoreFixture.ftHome}:${scoreFixture.ftAway}`,
          odd: 3.25,
          bookmakerId: 8,
        },
      ];

      if (
        marketIds.firstHalfWinner &&
        scoreFixture.htHome !== null &&
        scoreFixture.htAway !== null
      ) {
        scoreSelections.push({
          fixtureId: scoreFixture.fixtureId,
          betId: marketIds.firstHalfWinner,
          value: winnerToken(scoreFixture.htHome, scoreFixture.htAway),
          odd: 1.28,
          bookmakerId: 8,
        });
      }

      expect(scoreSelections.length).toBeGreaterThanOrEqual(5);

      const sortedGoals = [...eventFixture.goalEvents].sort((a, b) => {
        const aElapsed = toNumber(a.time?.elapsed) ?? 0;
        const bElapsed = toNumber(b.time?.elapsed) ?? 0;
        return aElapsed - bElapsed;
      });
      const firstGoal = sortedGoals[0];
      const lastGoal = sortedGoals[sortedGoals.length - 1];
      const firstSide =
        toNumber(firstGoal.team?.id) === eventFixture.homeId
          ? 'Home'
          : toNumber(firstGoal.team?.id) === eventFixture.awayId
            ? 'Away'
            : null;
      const lastSide =
        toNumber(lastGoal.team?.id) === eventFixture.homeId
          ? 'Home'
          : toNumber(lastGoal.team?.id) === eventFixture.awayId
            ? 'Away'
            : null;
      expect(firstSide).toBeTruthy();
      expect(lastSide).toBeTruthy();
      if (!firstSide || !lastSide) return;

      const eventSelections: TicketSelection[] = [
        {
          fixtureId: eventFixture.fixtureId,
          betId: marketIds.teamToScoreFirst,
          value: firstSide,
          odd: 1.6,
          bookmakerId: 8,
        },
        {
          fixtureId: eventFixture.fixtureId,
          betId: marketIds.teamToScoreLast,
          value: lastSide,
          odd: 1.6,
          bookmakerId: 8,
        },
        {
          fixtureId: eventFixture.fixtureId,
          betId: marketIds.cardsOverUnder,
          value: 'Over 0.5',
          odd: 1.18,
          bookmakerId: 8,
        },
      ];

      if (marketIds.anytimeGoalScorer && firstGoal.player?.name) {
        eventSelections.push({
          fixtureId: eventFixture.fixtureId,
          betId: marketIds.anytimeGoalScorer,
          value: firstGoal.player.name,
          odd: 1.72,
          bookmakerId: 8,
        });
      }

      expect(eventSelections.length).toBeGreaterThanOrEqual(3);

      const homeCorners = getTeamStat(statsFixture, 'home', ['Corner Kicks']);
      const awayCorners = getTeamStat(statsFixture, 'away', ['Corner Kicks']);
      expect(homeCorners).not.toBeNull();
      expect(awayCorners).not.toBeNull();
      if (homeCorners === null || awayCorners === null) return;

      const totalCorners = homeCorners + awayCorners;
      const statsSelections: TicketSelection[] = [
        {
          fixtureId: statsFixture.fixtureId,
          betId: marketIds.cornersOverUnder,
          value: totalCorners === 0 ? 'Under 0.5' : `Over ${(totalCorners - 0.5).toFixed(1)}`,
          odd: 1.31,
          bookmakerId: 8,
        },
        {
          fixtureId: statsFixture.fixtureId,
          betId: marketIds.corners1x2,
          value: homeCorners > awayCorners ? 'Home' : awayCorners > homeCorners ? 'Away' : 'Draw',
          odd: 1.45,
          bookmakerId: 8,
        },
      ];

      const homeOffsides = getTeamStat(statsFixture, 'home', ['Offsides']);
      const awayOffsides = getTeamStat(statsFixture, 'away', ['Offsides']);
      if (marketIds.offsides1x2 && homeOffsides !== null && awayOffsides !== null) {
        statsSelections.push({
          fixtureId: statsFixture.fixtureId,
          betId: marketIds.offsides1x2,
          value: homeOffsides > awayOffsides ? 'Home' : awayOffsides > homeOffsides ? 'Away' : 'Draw',
          odd: 1.44,
          bookmakerId: 8,
        });
      }

      const homeShotOnTarget = getTeamStat(statsFixture, 'home', [
        'Shots on Goal',
        'Shots On Goal',
        'Shots on Target',
      ]);
      const awayShotOnTarget = getTeamStat(statsFixture, 'away', [
        'Shots on Goal',
        'Shots On Goal',
        'Shots on Target',
      ]);
      if (marketIds.shotOnTarget1x2 && homeShotOnTarget !== null && awayShotOnTarget !== null) {
        statsSelections.push({
          fixtureId: statsFixture.fixtureId,
          betId: marketIds.shotOnTarget1x2,
          value:
            homeShotOnTarget > awayShotOnTarget
              ? 'Home'
              : awayShotOnTarget > homeShotOnTarget
                ? 'Away'
                : 'Draw',
          odd: 1.43,
          bookmakerId: 8,
        });
      }

      expect(statsSelections.length).toBeGreaterThanOrEqual(2);

      await settleTicketAndAssert({
        ticketId: `TK-HIST-SCORE-${Date.now()}`,
        stake: 10,
        selections: scoreSelections,
        expectedOutcome: 'won',
      });

      await settleTicketAndAssert({
        ticketId: `TK-HIST-EVENT-${Date.now()}`,
        stake: 8,
        selections: eventSelections,
        expectedOutcome: 'won',
      });

      await settleTicketAndAssert({
        ticketId: `TK-HIST-STATS-${Date.now()}`,
        stake: 7,
        selections: statsSelections,
        expectedOutcome: 'won',
      });

      const losingSelections = [...scoreSelections];
      const first = losingSelections[0];
      losingSelections[0] = {
        ...first,
        value:
          first.value === 'Home'
            ? 'Away'
            : first.value === 'Away'
              ? 'Home'
              : 'Home',
      };
      await settleTicketAndAssert({
        ticketId: `TK-HIST-LOSE-${Date.now()}`,
        stake: 6,
        selections: losingSelections,
        expectedOutcome: 'lost',
      });
    },
    180000,
  );
});
