import type { ApiBetSelectionInput } from '../validation/bets';

const normalizeHandicap = (value?: string | number) =>
  value === undefined || value === null ? undefined : String(value);

const oddsEqual = (a?: number, b?: number) => {
  if (a === undefined || b === undefined) return false;
  return Math.abs(Number(a) - Number(b)) <= 0.001;
};

const extractSelectionsFromItem = (item: any) => {
  const selections: Array<{
    betId?: number | string;
    value: string;
    odd: number;
    handicap?: string;
    suspended?: boolean;
    bookmakerId?: number;
  }> = [];

  if (Array.isArray(item?.bookmakers)) {
    for (const bookmaker of item.bookmakers) {
      const bookmakerId = bookmaker?.id;
      const bets = bookmaker?.bets ?? [];
      for (const bet of bets) {
        const values = bet?.values ?? [];
        for (const value of values) {
          if (value?.value && value?.odd) {
            selections.push({
              betId: bet?.id,
              value: String(value.value),
              odd: Number(value.odd),
              handicap: value?.handicap !== undefined ? String(value.handicap) : undefined,
              suspended: Boolean(value?.suspended),
              bookmakerId,
            });
          }
        }
      }
    }
  }

  if (Array.isArray(item?.odds)) {
    for (const bet of item.odds) {
      const values = bet?.values ?? [];
      for (const value of values) {
        if (value?.value && value?.odd) {
          selections.push({
            betId: bet?.id,
            value: String(value.value),
            odd: Number(value.odd),
            handicap: value?.handicap !== undefined ? String(value.handicap) : undefined,
            suspended: Boolean(value?.suspended),
          });
        }
      }
    }
  }

  return selections;
};

export const inPlayStatuses = new Set([
  '1H',
  'HT',
  '2H',
  'ET',
  'BT',
  'P',
  'SUSP',
  'INT',
  'LIVE',
  'FT',
  'AET',
  'PEN',
]);

export const isFixtureBlockedForPlacement = (fixtureStatus?: string): boolean =>
  Boolean(fixtureStatus && inPlayStatuses.has(fixtureStatus));

export const extractSelectionDetailsFromSnapshot = (
  snapshot: unknown,
  selection: ApiBetSelectionInput,
  fixtureId: number,
): { found: boolean; suspended?: boolean } => {
  if (!snapshot || typeof snapshot !== 'object') return { found: false };
  const response = (snapshot as { response?: unknown }).response;
  if (!Array.isArray(response)) return { found: false };
  const targetHandicap = normalizeHandicap(selection.handicap);
  const fixtureItems = response.filter(
    (item) => Number(item?.fixture?.id) === Number(fixtureId),
  );
  for (const item of fixtureItems) {
    const selections = extractSelectionsFromItem(item);
    for (const s of selections) {
      if (selection.bookmakerId && s.bookmakerId && Number(s.bookmakerId) !== Number(selection.bookmakerId)) {
        continue;
      }
      if (selection.betId && s.betId && String(s.betId) !== String(selection.betId)) {
        continue;
      }
      if (targetHandicap && normalizeHandicap(s.handicap) !== targetHandicap) {
        continue;
      }
      if (
        s.value.toLowerCase() === selection.value.toLowerCase() &&
        oddsEqual(Number(s.odd), Number(selection.odd))
      ) {
        return { found: true, suspended: Boolean(s.suspended) };
      }
    }
  }
  return { found: false };
};
