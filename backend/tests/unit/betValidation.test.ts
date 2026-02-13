import { describe, expect, it } from 'vitest';
import {
  extractSelectionDetailsFromSnapshot,
  isFixtureBlockedForPlacement,
  resolveSelectionFromSnapshot,
} from '../../src/services/betValidation';

const selection = {
  fixtureId: 1234,
  betId: 1,
  value: 'Home',
  odd: 2.5,
  bookmakerId: 8,
};

describe('betValidation', () => {
  it('marks historical/finished fixture status as blocked', () => {
    expect(isFixtureBlockedForPlacement('FT')).toBe(true);
    expect(isFixtureBlockedForPlacement('AET')).toBe(true);
    expect(isFixtureBlockedForPlacement('NS')).toBe(false);
  });

  it('finds matching selection in odds snapshot', () => {
    const snapshot = {
      response: [
        {
          fixture: { id: 1234 },
          bookmakers: [
            {
              id: 8,
              bets: [
                {
                  id: 1,
                  values: [{ value: 'Home', odd: '2.5', suspended: false }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(
      extractSelectionDetailsFromSnapshot(snapshot, selection, selection.fixtureId),
    ).toEqual({ found: true, suspended: false });
  });

  it('rejects old selection when odds changed in snapshot', () => {
    const snapshot = {
      response: [
        {
          fixture: { id: 1234 },
          bookmakers: [
            {
              id: 8,
              bets: [
                {
                  id: 1,
                  values: [{ value: 'Home', odd: '1.8', suspended: false }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(
      extractSelectionDetailsFromSnapshot(snapshot, selection, selection.fixtureId),
    ).toEqual({ found: false });
  });

  it('resolves current selection details without strict odd match', () => {
    const snapshot = {
      response: [
        {
          fixture: { id: 1234 },
          bookmakers: [
            {
              id: 8,
              bets: [
                {
                  id: 1,
                  values: [{ value: 'Home', odd: '1.8', suspended: false }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(
      resolveSelectionFromSnapshot(snapshot, selection, selection.fixtureId),
    ).toEqual({
      found: true,
      suspended: false,
      odd: 1.8,
      betId: 1,
      value: 'Home',
      handicap: undefined,
      bookmakerId: 8,
    });
  });
});
