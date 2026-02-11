import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type {
  FixtureResponse,
  OddResponse,
  ApiFootballResponse,
} from '../types/football';
import { compareIsoAsc, isPastIso } from '../lib/date';
import { getCurrentSeason } from '../lib/seasons';

type LeagueResponseItem = {
  seasons?: Array<{ current: boolean; year: number }>;
};

export interface Fixture extends Omit<FixtureResponse, 'odds'> {
  odds: {
    home: string;
    draw: string;
    away: string;
    doubleChance?: {
      homeDraw: string;
      homeAway: string;
      drawAway: string;
    };
    totals?: {
      over25: string;
      under25: string;
    };
  };
  markets: FixtureMarket[];
}

export interface FixtureMarketValue {
  value: string;
  odd: string;
  handicap?: string | null;
}

export interface FixtureMarket {
  id: number;
  name: string;
  values: FixtureMarketValue[];
}

export const TARGET_PREMATCH_LEAGUES = [39, 2, 40, 135, 140, 78, 61, 88, 45] as const;

const EMPTY_ODDS: Fixture['odds'] = {
  home: '',
  draw: '',
  away: '',
};

const extractOddsFromBookmaker = (
  bookmaker: OddResponse['bookmakers'][number] | undefined,
): { summary: Fixture['odds']; markets: FixtureMarket[] } => {
  if (!bookmaker) return { summary: { ...EMPTY_ODDS }, markets: [] };

  const formatted: Fixture['odds'] = { ...EMPTY_ODDS };
  const markets: FixtureMarket[] = (bookmaker.bets ?? []).map((bet) => ({
    id: bet.id,
    name: bet.name,
    values: (bet.values ?? []).map((value) => ({
      value: value.value,
      odd: value.odd,
      handicap: value.handicap,
    })),
  }));

  const matchWinner = bookmaker.bets?.find(
    (bet: { id: number; name: string }) => bet.id === 1 || /match winner|1x2/i.test(bet.name),
  );
  if (matchWinner?.values) {
    formatted.home =
      matchWinner.values.find((value: { value: string; odd: string }) => value.value === 'Home')
        ?.odd ?? '';
    formatted.draw =
      matchWinner.values.find((value: { value: string; odd: string }) => value.value === 'Draw')
        ?.odd ?? '';
    formatted.away =
      matchWinner.values.find((value: { value: string; odd: string }) => value.value === 'Away')
        ?.odd ?? '';
  }

  const doubleChance = bookmaker.bets?.find(
    (bet: { id: number; name: string }) => bet.id === 12 || /double chance/i.test(bet.name),
  );
  if (doubleChance?.values) {
    formatted.doubleChance = {
      homeDraw:
        doubleChance.values.find(
          (value: { value: string; odd: string }) => /home\/draw|1\/x|1x/i.test(value.value),
        )?.odd ?? '',
      homeAway:
        doubleChance.values.find(
          (value: { value: string; odd: string }) => /home\/away|1\/2|12/i.test(value.value),
        )?.odd ?? '',
      drawAway:
        doubleChance.values.find(
          (value: { value: string; odd: string }) => /draw\/away|x\/2|x2/i.test(value.value),
        )?.odd ?? '',
    };
  }

  const overUnder = bookmaker.bets?.find(
    (bet: { id: number; name: string }) => bet.id === 5 || /over\/under|totals?/i.test(bet.name),
  );
  if (overUnder?.values) {
    const over25 = overUnder.values.find(
      (value: { value: string; odd: string }) => /over/i.test(value.value) && /2([.,])?5/.test(value.value),
    );
    const under25 = overUnder.values.find(
      (value: { value: string; odd: string }) => /under/i.test(value.value) && /2([.,])?5/.test(value.value),
    );
    if (over25 || under25) {
      formatted.totals = {
        over25: over25?.odd ?? '',
        under25: under25?.odd ?? '',
      };
    }
  }

  return { summary: formatted, markets };
};

export const useFixturesSchedule = (
  leagueId: number,
  status = 'NS',
  next = 20,
) =>
  useQuery({
    queryKey: ['fixtures', 'schedule', leagueId, status],
    queryFn: async () => {
      const { data } = await api.get<ApiFootballResponse<FixtureResponse>>(
        '/football/fixtures',
        {
          params: {
            league: leagueId,
            status,
            next,
          },
        },
      );
      return data.response;
    },
    enabled: !!leagueId,
  });

export const fetchFixturesForLeague = async (
  leagueId: number,
  season?: number,
): Promise<Fixture[]> => {
  let currentSeason = season;

  if (!currentSeason) {
    try {
      const { data: leagueData } = await api.get<
        ApiFootballResponse<LeagueResponseItem>
      >('/football/leagues', {
        params: { id: leagueId, current: true },
      });

      currentSeason = leagueData.response?.[0]?.seasons?.find(
        (s: { current: boolean }) => s.current,
      )?.year;
    } catch (error) {
      console.error(`Failed to fetch season for league ${leagueId}`, error);
    }
  }

  if (!currentSeason) {
    return [];
  }

  const allOddsResponses: OddResponse[] = [];
  let currentPage = 1;
  let totalPages = 1;

  try {
    do {
      const { data: oddsData } = await api.get<ApiFootballResponse<OddResponse>>(
        '/football/odds',
        {
          params: {
            league: leagueId,
            season: currentSeason,
            bookmaker: 8,
            page: currentPage,
          },
        },
      );

      if (oddsData.response) {
        allOddsResponses.push(...oddsData.response);
      }
      totalPages = oddsData.paging?.total || 1;
      currentPage += 1;
    } while (currentPage <= totalPages);
  } catch (error) {
    console.error(`Failed to fetch odds for league ${leagueId}`, error);
    return [];
  }

  if (allOddsResponses.length === 0) {
    return [];
  }

  const fixtureOddsMap = new Map<number, Fixture['odds']>();
  const fixtureMarketsMap = new Map<number, FixtureMarket[]>();
  const fixtureIds = new Set<number>();

  for (const odds of allOddsResponses) {
    const fixtureId = odds.fixture?.id;
    const fixtureDate = odds.fixture?.date;

    if (!fixtureId || !fixtureDate || isPastIso(fixtureDate)) continue;

    fixtureIds.add(fixtureId);

    const extracted = extractOddsFromBookmaker(odds.bookmakers?.[0]);
    fixtureOddsMap.set(fixtureId, extracted.summary);
    fixtureMarketsMap.set(fixtureId, extracted.markets);
  }

  const orderedFixtureIds = Array.from(fixtureIds);
  if (orderedFixtureIds.length === 0) {
    return [];
  }

  const CHUNK_SIZE = 20;
  const chunks: string[] = [];
  for (let i = 0; i < orderedFixtureIds.length; i += CHUNK_SIZE) {
    chunks.push(orderedFixtureIds.slice(i, i + CHUNK_SIZE).join('-'));
  }

  const allFixtures: FixtureResponse[] = [];
  const fixtureResponses = await Promise.all(
    chunks.map((idsParam) =>
      api.get<ApiFootballResponse<FixtureResponse>>('/football/fixtures', {
        params: { ids: idsParam },
      }),
    ),
  );

  fixtureResponses.forEach((response) => {
    const fixturesData = response.data.response;
    if (fixturesData) {
      allFixtures.push(...fixturesData);
    }
  });

  return allFixtures
    .filter((fixture) => fixture.fixture.status.short === 'NS')
    .map((fixture) => ({
      ...fixture,
      odds: fixtureOddsMap.get(fixture.fixture.id) || { ...EMPTY_ODDS },
      markets: fixtureMarketsMap.get(fixture.fixture.id) || [],
    }))
    .sort((a, b) => compareIsoAsc(a.fixture.date, b.fixture.date));
};

export const usePreMatchFixtures = (leagueId: number | null | 0) =>
  useQuery({
    queryKey: ['fixtures', 'prematch', 'league', leagueId],
    queryFn: async () => {
      if (!leagueId || leagueId === 0) return [];
      return fetchFixturesForLeague(leagueId, getCurrentSeason());
    },
    enabled: Boolean(leagueId && leagueId !== 0),
    staleTime: 60 * 1000,
  });

export const useAllLeaguesPreMatchFixtures = (enabled = true) => {
  const season = getCurrentSeason();
  const queries = useQueries({
    queries: TARGET_PREMATCH_LEAGUES.map((leagueId) => ({
      queryKey: ['fixtures', 'prematch', 'league', leagueId],
      queryFn: () => fetchFixturesForLeague(leagueId, season),
      staleTime: 60 * 1000,
      enabled,
    })),
  });

  const data = useMemo(() => {
    const merged = queries.flatMap((query) => query.data ?? []);
    merged.sort((a, b) => compareIsoAsc(a.fixture.date, b.fixture.date));
    return merged;
  }, [queries]);

  const isLoading =
    data.length === 0 && queries.some((query) => query.isPending || query.isFetching);
  const isFetching = queries.some((query) => query.isFetching);
  const error = queries.find((query) => query.error)?.error ?? null;

  return {
    data,
    isLoading,
    isFetching,
    error,
  };
};

export const useFixtureDetails = (fixtureId: number) =>
  useQuery({
    queryKey: ['fixture', 'details', fixtureId],
    queryFn: async () => {
      const [oddsRes, statsRes, predictionsRes, eventsRes, fixtureRes] =
        await Promise.all([
          api.get<ApiFootballResponse<OddResponse>>('/football/odds', {
            params: { fixture: fixtureId },
          }),
          api.get<ApiFootballResponse<Record<string, unknown>>>(
            '/football/fixtures/statistics',
            {
              params: { fixture: fixtureId },
            },
          ),
          api.get<ApiFootballResponse<Record<string, unknown>>>('/football/predictions', {
            params: { fixture: fixtureId },
          }),
          api.get<ApiFootballResponse<Record<string, unknown>>>('/football/fixtures/events', {
            params: { fixture: fixtureId },
          }),
          api.get<ApiFootballResponse<FixtureResponse>>('/football/fixtures', {
            params: { id: fixtureId },
          }),
        ]);

      const odds = oddsRes.data.response?.[0];
      const stats = statsRes.data.response;
      const predictions = predictionsRes.data.response?.[0];
      const events = eventsRes.data.response;
      const fixtureData = fixtureRes.data.response?.[0];

      return {
        fixture: fixtureData,
        odds,
        stats,
        predictions,
        events,
      };
    },
    enabled: !!fixtureId,
  });

export const useLiveFixtures = (leagueIds?: number[], enabled = true) =>
  useQuery({
    queryKey: ['fixtures', 'live', leagueIds],
    queryFn: async () => {
      const params: Record<string, string> = { live: 'all' };
      if (leagueIds && leagueIds.length > 0) {
        params.live = leagueIds.join('-');
      }

      const { data } = await api.get<ApiFootballResponse<FixtureResponse>>(
        '/football/fixtures',
        {
          params,
        },
      );
      return data.response;
    },
    refetchInterval: enabled ? 15000 : false,
    enabled,
  });

export const useLiveOdds = (leagueId?: number, enabled = true) =>
  useQuery({
    queryKey: ['odds', 'live', leagueId],
    queryFn: async () => {
      const params: Record<string, number> = {};
      if (leagueId) params.league = leagueId;

      const { data } = await api.get<ApiFootballResponse<OddResponse>>(
        '/football/odds/live',
        {
          params,
        },
      );
      return data.response;
    },
    refetchInterval: enabled ? 5000 : false,
    enabled,
  });

export const useLiveMatches = (options?: { enabled?: boolean }) => {
  const enabled = options?.enabled ?? true;
  const { data: fixtures, isLoading: isFixturesLoading } = useLiveFixtures(undefined, enabled);
  const { data: odds, isLoading: isOddsLoading } = useLiveOdds(undefined, enabled);

  const mergedData =
    fixtures?.map((fixtureItem) => {
      const fixtureId = fixtureItem.fixture.id;
      const liveOddsItem = odds?.find((o) => o?.fixture?.id === fixtureId);

      let formattedOdds: Fixture['odds'] = { ...EMPTY_ODDS };
      let markets: FixtureMarket[] = [];

      if (liveOddsItem && liveOddsItem.bookmakers && liveOddsItem.bookmakers.length > 0) {
        const extracted = extractOddsFromBookmaker(liveOddsItem.bookmakers[0]);
        formattedOdds = extracted.summary;
        markets = extracted.markets;
      }

      return {
        ...fixtureItem,
        odds: formattedOdds,
        markets,
      };
    }) || [];

  return {
    data: mergedData,
    isLoading: isFixturesLoading || isOddsLoading,
  };
};
