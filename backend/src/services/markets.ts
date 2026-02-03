type MarketSelection = {
  value: string;
  odd: string | number;
  handicap?: string | number | null;
  main?: boolean | null;
  suspended?: boolean | null;
};

type Market = {
  id: number | string;
  name: string;
  selections: MarketSelection[];
};

type OddsMarket = {
  id?: number;
  name?: string;
  values?: Array<{
    value?: string;
    odd?: string;
    handicap?: string;
    main?: boolean;
    suspended?: boolean;
  }>;
};

type OddsResponseItem = {
  fixture?: { id?: number };
  bookmaker?: { id?: number; name?: string };
  bets?: OddsMarket[];
};

const normalizeSelections = (values: OddsMarket['values']): MarketSelection[] => {
  if (!values) return [];
  return values
    .filter((v) => v.value && v.odd)
    .map((v) => ({
      value: String(v.value),
      odd: v.odd ?? '',
      handicap: v.handicap ?? null,
      main: v.main ?? null,
      suspended: v.suspended ?? null,
    }));
};

const findBet = (bets: OddsMarket[] | undefined, names: string[]): OddsMarket | undefined => {
  if (!bets) return undefined;
  const lowerNames = names.map((n) => n.toLowerCase());
  return bets.find((bet) => {
    const name = String(bet.name ?? '').toLowerCase();
    return lowerNames.some((n) => name.includes(n));
  });
};

export const normalizeMarkets = (items: OddsResponseItem[]) => {
  return items.map((item) => {
    const bets = item.bets ?? [];
    const matchWinner = findBet(bets, ['match winner', 'winner']);
    const overUnder = findBet(bets, ['over/under', 'over under']);
    const btts = findBet(bets, ['both teams to score', 'btts']);

    const markets: Market[] = [];

    if (matchWinner) {
      markets.push({
        id: matchWinner.id ?? 'match-winner',
        name: matchWinner.name ?? 'Match Winner',
        selections: normalizeSelections(matchWinner.values),
      });
    }

    if (overUnder) {
      markets.push({
        id: overUnder.id ?? 'over-under',
        name: overUnder.name ?? 'Over/Under',
        selections: normalizeSelections(overUnder.values),
      });
    }

    if (btts) {
      markets.push({
        id: btts.id ?? 'btts',
        name: btts.name ?? 'Both Teams To Score',
        selections: normalizeSelections(btts.values),
      });
    }

    return {
      fixtureId: item.fixture?.id ?? null,
      bookmaker: item.bookmaker ?? null,
      markets,
    };
  });
};
