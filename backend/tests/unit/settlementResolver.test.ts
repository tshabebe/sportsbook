import { describe, expect, it } from 'vitest';
import {
  resolveBetOutcome,
  resolveSelectionOutcome,
  shouldFetchEventsForMarket,
  shouldFetchStatisticsForMarket,
  type FixtureSettlementContext,
  type SelectionSettlementInput,
} from '../../src/services/settlementResolver';

const createFixture = (
  fixtureId: number,
  input?: Partial<FixtureSettlementContext>,
): FixtureSettlementContext => ({
  ...(() => {
    const base: FixtureSettlementContext = {
      fixtureId,
      statusShort: 'FT',
      teams: {
        home: { id: 1, name: 'Home FC' },
        away: { id: 2, name: 'Away FC' },
      },
      goals: { home: 2, away: 1 },
      score: {
        halftime: { home: 1, away: 0 },
        fulltime: { home: 2, away: 1 },
      },
    };

    return {
      ...base,
      ...input,
      teams: {
        ...base.teams,
        ...input?.teams,
        home: { ...base.teams?.home, ...input?.teams?.home },
        away: { ...base.teams?.away, ...input?.teams?.away },
      },
      goals: {
        ...base.goals,
        ...input?.goals,
      },
      score: {
        ...base.score,
        ...input?.score,
        halftime: {
          ...base.score?.halftime,
          ...input?.score?.halftime,
        },
        fulltime: {
          ...base.score?.fulltime,
          ...input?.score?.fulltime,
        },
        extratime: {
          ...base.score?.extratime,
          ...input?.score?.extratime,
        },
        penalty: {
          ...base.score?.penalty,
          ...input?.score?.penalty,
        },
      },
    };
  })(),
});

describe('settlementResolver', () => {
  it('resolves match winner, double chance, and totals', () => {
    const fixture = createFixture(1001, { goals: { home: 3, away: 1 } });

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1001, marketName: 'Match Winner', value: 'Home' },
        fixture,
      ).outcome,
    ).toBe('won');

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1001, marketName: 'Double Chance', value: 'Home/Away' },
        fixture,
      ).outcome,
    ).toBe('won');

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1001, marketName: 'Goals Over/Under', value: 'Over 2.5' },
        fixture,
      ).outcome,
    ).toBe('won');
  });

  it('handles draw no bet and exact score', () => {
    const drawFixture = createFixture(1002, {
      goals: { home: 1, away: 1 },
      score: { fulltime: { home: 1, away: 1 } },
    });
    expect(
      resolveSelectionOutcome(
        { fixtureId: 1002, marketName: 'Draw No Bet', value: 'Home' },
        drawFixture,
      ).outcome,
    ).toBe('void');

    const exactFixture = createFixture(1003, { goals: { home: 2, away: 1 } });
    expect(
      resolveSelectionOutcome(
        { fixtureId: 1003, marketName: 'Exact Score', value: '2-1' },
        exactFixture,
      ).outcome,
    ).toBe('won');
  });

  it('handles first-half and second-half winner markets', () => {
    const fixture = createFixture(1007, {
      goals: { home: 2, away: 1 },
      score: {
        halftime: { home: 0, away: 1 },
        fulltime: { home: 2, away: 1 },
      },
    });

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1007, marketName: '1st Half Winner', value: 'Away' },
        fixture,
      ).outcome,
    ).toBe('won');

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1007, marketName: '2nd Half Winner', value: 'Home' },
        fixture,
      ).outcome,
    ).toBe('won');
  });

  it('handles half-time/full-time and range totals markets', () => {
    const fixture = createFixture(1008, {
      goals: { home: 2, away: 1 },
      score: {
        halftime: { home: 1, away: 0 },
        fulltime: { home: 2, away: 1 },
      },
    });

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1008, marketName: 'Half Time/Full Time', value: '1/1' },
        fixture,
      ).outcome,
    ).toBe('won');

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1008, marketName: 'Total Goals', value: '2-3' },
        fixture,
      ).outcome,
    ).toBe('won');
  });

  it('handles first/last goal team and scorer markets', () => {
    const fixture = createFixture(1009, {
      goals: { home: 2, away: 1 },
      score: {
        halftime: { home: 1, away: 0 },
        fulltime: { home: 2, away: 1 },
      },
      events: [
        {
          type: 'Goal',
          detail: 'Normal Goal',
          time: { elapsed: 10 },
          team: { id: 1 },
          player: { name: 'First Scorer' },
        },
        {
          type: 'Goal',
          detail: 'Normal Goal',
          time: { elapsed: 80 },
          team: { id: 2 },
          player: { name: 'Last Scorer' },
        },
      ],
    });

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1009, marketName: 'First Goal', value: 'Home' },
        fixture,
      ).outcome,
    ).toBe('won');

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1009, marketName: 'Last Goalscorer', value: 'Last Scorer' },
        fixture,
      ).outcome,
    ).toBe('won');
  });

  it('handles win-to-nil and clean-sheet markets', () => {
    const fixture = createFixture(1010, {
      goals: { home: 2, away: 0 },
      score: {
        halftime: { home: 1, away: 0 },
        fulltime: { home: 2, away: 0 },
      },
    });

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1010, marketName: 'Win To Nil', value: 'Home' },
        fixture,
      ).outcome,
    ).toBe('won');

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1010, marketName: 'Clean Sheet - Home', value: 'Yes' },
        fixture,
      ).outcome,
    ).toBe('won');
  });

  it('handles either-half and highest-scoring-half markets', () => {
    const fixture = createFixture(1011, {
      goals: { home: 2, away: 1 },
      score: {
        halftime: { home: 0, away: 0 },
        fulltime: { home: 2, away: 1 },
      },
    });

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1011, marketName: 'To Win Either Half', value: 'Home' },
        fixture,
      ).outcome,
    ).toBe('won');

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1011, marketName: 'Highest Scoring Half', value: '2nd Half' },
        fixture,
      ).outcome,
    ).toBe('won');
  });

  it('handles cards and corners with fixture enrichments', () => {
    const fixture = createFixture(1004, {
      events: [
        { type: 'Card', detail: 'Yellow Card', team: { id: 1 } },
        { type: 'Card', detail: 'Yellow Card', team: { id: 2 } },
        { type: 'Card', detail: 'Red Card', team: { id: 2 } },
      ],
      statistics: [
        {
          team: { id: 1 },
          statistics: [{ type: 'Corner Kicks', value: 4 }],
        },
        {
          team: { id: 2 },
          statistics: [{ type: 'Corner Kicks', value: 3 }],
        },
      ],
    });

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1004, marketName: 'Total Corners', value: 'Over 6.5' },
        fixture,
      ).outcome,
    ).toBe('won');

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1004, marketName: 'Total Cards', value: 'Over 2.5' },
        fixture,
      ).outcome,
    ).toBe('won');
  });

  it('handles player scorer and team-to-score markets', () => {
    const fixture = createFixture(1005, {
      goals: { home: 2, away: 0 },
      score: { fulltime: { home: 2, away: 0 } },
      events: [
        { type: 'Goal', detail: 'Normal Goal', player: { name: 'John Doe' }, team: { id: 1 } },
      ],
    });

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1005, marketName: 'Anytime Goalscorer', value: 'John Doe' },
        fixture,
      ).outcome,
    ).toBe('won');

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1005, marketName: 'Away Team To Score', value: 'No' },
        fixture,
      ).outcome,
    ).toBe('won');
  });

  it('settles mixed-market accumulator using fixture map', () => {
    const selectionA: SelectionSettlementInput = {
      fixtureId: 2001,
      marketName: 'Match Winner',
      value: 'Home',
      odd: 1.9,
    };
    const selectionB: SelectionSettlementInput = {
      fixtureId: 2002,
      marketName: 'Both Teams To Score',
      value: 'No',
      odd: 1.7,
    };

    const fixtureById = new Map<number, FixtureSettlementContext>([
      [
        2001,
        createFixture(2001, {
          goals: { home: 2, away: 0 },
          score: { fulltime: { home: 2, away: 0 } },
        }),
      ],
      [
        2002,
        createFixture(2002, {
          goals: { home: 1, away: 0 },
          score: { fulltime: { home: 1, away: 0 } },
        }),
      ],
    ]);

    const settled = resolveBetOutcome([selectionA, selectionB], fixtureById, 10);
    expect(settled.outcome).toBe('won');
    expect(settled.payout).toBeCloseTo(32.3, 2);
  });

  it('returns unresolved when fixture is not final', () => {
    const fixture = createFixture(1006, { statusShort: '1H' });
    const resolved = resolveSelectionOutcome(
      { fixtureId: 1006, marketName: 'Match Winner', value: 'Home' },
      fixture,
    );
    expect(resolved.outcome).toBe('unresolved');
  });

  it('flags markets that require events/statistics enrichment', () => {
    expect(shouldFetchEventsForMarket('Total Cards')).toBe(true);
    expect(shouldFetchEventsForMarket('Anytime Goalscorer')).toBe(true);
    expect(shouldFetchEventsForMarket('Late Goal (Range)')).toBe(true);
    expect(shouldFetchStatisticsForMarket('Total Corners')).toBe(true);
    expect(shouldFetchStatisticsForMarket('Match Winner')).toBe(false);
  });

  it('handles previously blocked alias market names', () => {
    const fixture = createFixture(1012, {
      goals: { home: 2, away: 1 },
      score: {
        halftime: { home: 1, away: 0 },
        fulltime: { home: 2, away: 1 },
      },
      events: [
        {
          type: 'Goal',
          detail: 'Normal Goal',
          time: { elapsed: 12 },
          team: { id: 1 },
          player: { name: 'Early Scorer' },
        },
        {
          type: 'Goal',
          detail: 'Normal Goal',
          time: { elapsed: 80 },
          team: { id: 2 },
          player: { name: 'Late Scorer' },
        },
      ],
    });

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1012, marketName: 'Correct Score - First Half', value: '1-0' },
        fixture,
      ).outcome,
    ).toBe('won');

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1012, marketName: 'Correct Score - Second Half', value: '1-1' },
        fixture,
      ).outcome,
    ).toBe('won');

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1012, marketName: 'Home team will score in both halves', value: 'Yes' },
        fixture,
      ).outcome,
    ).toBe('won');

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1012, marketName: 'Home Win/Over', value: 'Over 2.5' },
        fixture,
      ).outcome,
    ).toBe('won');

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1012, marketName: 'Either Team Wins By 1 Goals', value: 'Yes' },
        fixture,
      ).outcome,
    ).toBe('won');

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1012, marketName: 'Which team will score the 1st goal?', value: 'Home' },
        fixture,
      ).outcome,
    ).toBe('won');

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1012, marketName: 'Early Goal (Range)', value: '1-15' },
        fixture,
      ).outcome,
    ).toBe('won');

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1012, marketName: 'Late Goal (Range)', value: '76-90' },
        fixture,
      ).outcome,
    ).toBe('won');

    expect(
      resolveSelectionOutcome(
        { fixtureId: 1012, marketName: 'Team Performances (Range)', value: '3-5' },
        fixture,
      ).outcome,
    ).toBe('won');
  });
});
