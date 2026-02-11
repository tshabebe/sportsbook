import { useMemo } from 'react';
import {
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  Button as AriaButton,
} from 'react-aria-components';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import { Leaderboard } from '../components/Leaderboard';
import {
  useAllLeaguesPreMatchFixtures,
  usePreMatchFixtures,
  type Fixture,
  type FixtureMarket,
} from '../hooks/useFootball';
import { LeagueGroup } from '../components/LeagueGroup';
import { LEAGUES } from '../data/leagues';

type DateFilter = 'all' | 'today' | 'tomorrow' | 'next7d';
type CoreMarketView = '1x2' | 'double_chance' | 'over_under';
type ExtraMarketView = `extra_${number}`;
type MarketView = CoreMarketView | ExtraMarketView;
type ExtraMarketOption = {
  id: number;
  key: ExtraMarketView;
  label: string;
  sampleLabels: string[];
};
const CORE_MARKET_IDS = new Set([1, 12, 5]);

const marketOptions: Array<{ key: CoreMarketView; label: string }> = [
  { key: '1x2', label: '1X2' },
  { key: 'double_chance', label: 'Double Chance' },
  { key: 'over_under', label: 'O/U 2.5' },
];

const isExtraMarketView = (value: string | null): value is ExtraMarketView =>
  Boolean(value && /^extra_\d+$/.test(value));

const parseMarketView = (value: string | null): MarketView => {
  if (value === 'double_chance' || value === 'over_under' || value === '1x2') return value;
  if (isExtraMarketView(value)) return value;
  return '1x2';
};

const formatMarketOutcomeLabel = (value: FixtureMarket['values'][number]): string =>
  value.handicap ? `${value.value} ${value.handicap}` : value.value;

const SoccerIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height="1em"
    viewBox="-10 0 1063 1024"
    className="h-4 w-4"
    fill="currentColor"
  >
    <path d="M339.646 35.773C276 61.233 219.424 99.42 169.921 147.507 120.418 197.01 83.646 253.584 58.186 317.232 32.727 379.464 19.999 444.525 19.999 511s12.728 131.536 38.187 192.354c25.46 63.647 63.647 120.222 111.735 169.725 49.503 49.503 106.077 86.276 169.725 111.735 60.817 25.46 125.878 36.773 192.354 36.773s131.536-12.729 192.354-36.773c63.647-25.46 120.222-63.646 169.725-111.735 49.503-49.502 86.275-106.077 111.735-169.725 25.459-60.817 36.773-125.878 36.773-192.354s-12.729-131.536-36.773-192.354C980.354 255 942.168 198.424 894.079 148.921S788.002 62.646 724.354 37.186C663.537 11.727 598.476-1 532-1S400.464 11.727 339.646 35.772zm-192.353 690.21c-24.044-15.559-46.674-33.945-67.89-53.746-31.116-86.276-35.359-179.624-15.558-268.73 9.901-18.386 19.802-36.772 32.53-53.745 5.657-7.071 8.486-11.315 12.729-16.972l115.979 67.89v2.829c0 62.232 5.657 124.464 18.386 183.867l-89.104 140.022c-2.83 1.413-4.243 0-7.072-1.414zm343.69 237.614c19.8 9.901 41.017 18.388 60.817 25.459-89.104 4.243-179.624-16.972-260.243-62.231l195.183 33.944c1.414 1.414 2.83 1.414 4.244 2.829zm0-35.359L261.856 887.22c-26.873-32.529-50.917-66.474-72.134-103.249-5.656-9.9-11.314-18.386-15.557-28.287l89.104-140.02c1.414 0 4.243 1.413 7.072 1.413 56.576 15.558 113.15 25.46 169.725 33.946 2.828 0 5.657 1.413 8.486 1.413l108.906 185.282c-18.387 25.459-36.774 52.33-56.575 77.79-2.83 5.657-7.073 8.486-9.9 12.73zm380.465-79.205c-18.388 18.387-38.188 33.944-57.99 49.503-2.828-26.873-8.486-53.746-16.971-79.204l113.148-212.155c31.116-14.144 62.232-31.116 90.52-50.917q6.364-4.244 8.485-8.486c-7.071 110.32-53.746 217.812-137.192 301.26zm-5.658-275.801c4.243 8.485 8.486 16.972 12.729 24.044l-110.32 206.497h-1.414c-59.403 11.314-120.22 16.972-181.039 16.972l-110.32-190.94c16.973-32.529 33.946-63.645 50.917-96.176 11.316-21.215 22.63-43.845 33.946-65.06l227.713-24.045c28.287 42.431 55.16 84.862 77.79 128.707z" />
  </svg>
);

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const dateParam = searchParams.get('date');
  const dateFilter: DateFilter =
    dateParam === 'today' || dateParam === 'tomorrow' || dateParam === 'next7d'
      ? dateParam
      : 'all';
  const marketParam = searchParams.get('market');
  const marketView = parseMarketView(marketParam);

  const queryLeagueId = Number(searchParams.get('league') ?? '0');
  const selectedLeagueId =
    Number.isFinite(queryLeagueId) && queryLeagueId > 0 ? queryLeagueId : 0;

  const shouldLoadAllLeagues = selectedLeagueId === 0;
  const allLeaguesQuery = useAllLeaguesPreMatchFixtures(shouldLoadAllLeagues);
  const selectedLeagueQuery = usePreMatchFixtures(selectedLeagueId);

  const preMatchFixtures = useMemo(
    () => (selectedLeagueId === 0 ? allLeaguesQuery.data : selectedLeagueQuery.data ?? []),
    [allLeaguesQuery.data, selectedLeagueId, selectedLeagueQuery.data],
  );
  const isLoadingPre =
    selectedLeagueId === 0 ? allLeaguesQuery.isLoading : selectedLeagueQuery.isLoading;
  const isFetchingPre =
    selectedLeagueId === 0 ? allLeaguesQuery.isFetching : selectedLeagueQuery.isFetching;
  const errorPre = selectedLeagueId === 0 ? allLeaguesQuery.error : selectedLeagueQuery.error;

  const rawFixtures = preMatchFixtures;
  const isLoading = isLoadingPre;
  const error = errorPre;

  const fixtures = useMemo(() => {
    if (!rawFixtures) return [];
    let nextFixtures = rawFixtures;

    if (selectedLeagueId !== 0) {
      nextFixtures = nextFixtures.filter(
        (fixture) => fixture.league.id === selectedLeagueId,
      );
    }

    if (dateFilter === 'all') return nextFixtures;

    const now = dayjs();
    return nextFixtures.filter((fixture) => {
      const at = dayjs(fixture.fixture.date);
      if (dateFilter === 'today') return at.isSame(now, 'day');
      if (dateFilter === 'tomorrow') return at.isSame(now.add(1, 'day'), 'day');
      return at.isAfter(now) && at.isBefore(now.add(7, 'day').endOf('day'));
    });
  }, [dateFilter, rawFixtures, selectedLeagueId]);

  const extraMarketOptions = useMemo(() => {
    const optionMap = new Map<
      number,
      ExtraMarketOption & { fixtureCount: number }
    >();

    fixtures.forEach((fixture) => {
      fixture.markets.forEach((market) => {
        if (CORE_MARKET_IDS.has(market.id)) return;

        const selectableValues = market.values.filter((value) => {
          const odd = Number(value.odd);
          return Number.isFinite(odd) && odd > 1;
        });

        if (selectableValues.length === 0) return;

        const existing = optionMap.get(market.id);
        if (!existing) {
          optionMap.set(market.id, {
            id: market.id,
            key: `extra_${market.id}` as ExtraMarketView,
            label: market.name,
            sampleLabels: selectableValues
              .slice(0, 3)
              .map((value) => formatMarketOutcomeLabel(value)),
            fixtureCount: 1,
          });
          return;
        }

        existing.fixtureCount += 1;
      });
    });

    return Array.from(optionMap.values())
      .sort(
        (a, b) =>
          b.fixtureCount - a.fixtureCount || a.label.localeCompare(b.label),
      )
      .map((option) => ({
        id: option.id,
        key: option.key,
        label: option.label,
        sampleLabels: option.sampleLabels,
      }));
  }, [fixtures]);

  const selectedExtraMarket = isExtraMarketView(marketView)
    ? extraMarketOptions.find((option) => option.key === marketView) ?? null
    : null;

  const effectiveMarketView: MarketView =
    isExtraMarketView(marketView) && !selectedExtraMarket ? '1x2' : marketView;

  const groupedFixtures = useMemo(() => {
    return fixtures.reduce(
      (groups, fixture) => {
        const leagueName = fixture.league.name;
        if (!groups[leagueName]) {
          groups[leagueName] = {
            fixtures: [],
            logo: fixture.league.logo,
            flag: fixture.league.flag || '',
          };
        }
        groups[leagueName].fixtures.push(fixture);
        return groups;
      },
      {} as Record<string, { fixtures: Fixture[]; logo: string; flag: string }>,
    );
  }, [fixtures]);

  const leagueCounts = useMemo(() => {
    return preMatchFixtures.reduce((map, fixture) => {
      const leagueId = fixture.league.id;
      map.set(leagueId, (map.get(leagueId) ?? 0) + 1);
      return map;
    }, new Map<number, number>());
  }, [preMatchFixtures]);

  const updateParam = (
    key: 'league' | 'date' | 'market',
    value: string | null,
    defaultValue?: string,
  ) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (value === null || value.length === 0 || (defaultValue && value === defaultValue)) {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleLeagueChange = (leagueId: number) => {
    updateParam('league', leagueId === 0 ? null : String(leagueId));
  };

  const handleExtraMarketChange = (key: string) => {
    if (key === 'none') {
      updateParam('market', null, '1x2');
      return;
    }
    updateParam('market', key);
  };

  const fixtureSkeletons = Array.from({ length: 6 }, (_, index) => index);

  const leagueIconFor = (leagueId: number) => {
    switch (leagueId) {
      case 0:
        return '';
      case 39:
      case 40:
      case 45:
        return '🏴';
      case 88:
        return '🇳🇱';
      case 61:
        return '🇫🇷';
      case 78:
        return '🇩🇪';
      case 135:
        return '🇮🇹';
      case 140:
        return '🇪🇸';
      default:
        return '⚽';
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 pb-20 md:pb-0">
      <div className="rounded-xl border border-[#333] bg-[#1d1d1d] p-2.5">
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="w-full">
              <Select
                aria-label="Date filter"
                selectedKey={dateFilter}
                onSelectionChange={(key) =>
                  updateParam('date', String(key), 'all')
                }
                className="w-full"
              >
                <AriaButton
                  data-testid="date-filter-trigger"
                  className="flex w-full items-center justify-between rounded-lg border border-[#333] bg-[#141414] px-3 py-2 text-sm font-semibold text-[#fafafa] disabled:opacity-60"
                >
                  <SelectValue />
                  <span aria-hidden>▾</span>
                </AriaButton>
                <Popover className="w-(--trigger-width) rounded-lg border border-[#333] bg-[#1d1d1d] p-1 text-[#fafafa] shadow-lg data-[entering]:animate-in data-[entering]:fade-in data-[entering]:zoom-in-95 data-[exiting]:animate-out data-[exiting]:fade-out data-[exiting]:zoom-out-95">
                  <ListBox className="outline-none">
                    <ListBoxItem
                      id="all"
                      className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-[#2a2a2a] data-[selected]:bg-[#ffd60a] data-[selected]:text-[#1d1d1d]"
                    >
                      All Dates
                    </ListBoxItem>
                    <ListBoxItem
                      id="today"
                      className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-[#2a2a2a] data-[selected]:bg-[#ffd60a] data-[selected]:text-[#1d1d1d]"
                    >
                      Today
                    </ListBoxItem>
                    <ListBoxItem
                      id="tomorrow"
                      className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-[#2a2a2a] data-[selected]:bg-[#ffd60a] data-[selected]:text-[#1d1d1d]"
                    >
                      Tomorrow
                    </ListBoxItem>
                    <ListBoxItem
                      id="next7d"
                      className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-[#2a2a2a] data-[selected]:bg-[#ffd60a] data-[selected]:text-[#1d1d1d]"
                    >
                      Next 7 Days
                    </ListBoxItem>
                  </ListBox>
                </Popover>
              </Select>
            </div>

            <div className="w-full">
              <Select
                aria-label="Additional market filter"
                selectedKey={
                  isExtraMarketView(effectiveMarketView)
                    ? effectiveMarketView
                    : 'none'
                }
                onSelectionChange={(key) =>
                  handleExtraMarketChange(String(key))
                }
                className="w-full"
              >
                <AriaButton
                  data-testid="extra-market-trigger"
                  className="flex w-full items-center justify-between rounded-lg border border-[#333] bg-[#141414] px-3 py-2 text-sm font-semibold text-[#fafafa] disabled:opacity-60"
                >
                  <SelectValue />
                  <span aria-hidden>▾</span>
                </AriaButton>
                <Popover className="w-(--trigger-width) rounded-lg border border-[#333] bg-[#1d1d1d] p-1 text-[#fafafa] shadow-lg data-[entering]:animate-in data-[entering]:fade-in data-[entering]:zoom-in-95 data-[exiting]:animate-out data-[exiting]:fade-out data-[exiting]:zoom-out-95">
                  <ListBox className="outline-none">
                    <ListBoxItem
                      id="none"
                      data-testid="extra-market-option-none"
                      className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-[#2a2a2a] data-[selected]:bg-[#ffd60a] data-[selected]:text-[#1d1d1d]"
                    >
                      More Markets
                    </ListBoxItem>
                    {extraMarketOptions.length === 0 ? (
                      <ListBoxItem
                        id="no-extra-markets"
                        isDisabled
                        className="cursor-not-allowed rounded px-3 py-2 text-sm text-[#8a8a8a]"
                      >
                        No extra markets available
                      </ListBoxItem>
                    ) : (
                      extraMarketOptions.map((option) => (
                        <ListBoxItem
                          key={option.key}
                          id={option.key}
                          data-testid={`extra-market-option-${option.id}`}
                          className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-[#2a2a2a] data-[selected]:bg-[#ffd60a] data-[selected]:text-[#1d1d1d]"
                        >
                          {option.label}
                        </ListBoxItem>
                      ))
                    )}
                  </ListBox>
                </Popover>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {LEAGUES.map((league) => {
              const isActive = selectedLeagueId === league.id;
              const count =
                league.id === 0
                  ? preMatchFixtures.length
                  : leagueCounts.get(league.id) ?? 0;
              return (
                <button
                  key={league.id}
                  type="button"
                  data-testid={`league-pill-${league.id}`}
                  onClick={() => handleLeagueChange(league.id)}
                  className={`shrink-0 inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold ${
                    isActive
                      ? 'bg-[#ffd60a] text-[#1d1d1d]'
                      : 'bg-[#2a2a2a] text-[#c8c8c8] hover:bg-[#333]'
                  }`}
                >
                  {league.id === 0 ? (
                    <SoccerIcon />
                  ) : (
                    <span aria-hidden className="text-[14px] leading-none">
                      {leagueIconFor(league.id)}
                    </span>
                  )}
                  <span className="leading-none">{league.id === 0 ? 'All' : league.name}</span>
                  <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[11px] font-medium">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {marketOptions.map((option) => {
              const isActive = effectiveMarketView === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  data-testid={`market-tab-${option.key}`}
                  onClick={() => updateParam('market', option.key, '1x2')}
                  className={`shrink-0 rounded-md px-3.5 py-2 text-sm font-semibold ${
                    isActive
                      ? 'bg-[#31ae2f] text-[#041207]'
                      : 'bg-[#2a2a2a] text-[#c8c8c8] hover:bg-[#333]'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {selectedLeagueId === 0 && isFetchingPre ? (
            <p className="text-xs text-[#c8c8c8]">Loading more leagues...</p>
          ) : null}
        </div>
      </div>

      <div className="min-h-[500px]">
        {isFetchingPre && fixtures.length > 0 ? (
          <p className="mb-2 text-xs text-[#c8c8c8]">Refreshing odds...</p>
        ) : null}
        {isLoading && fixtures.length === 0 ? (
          <div
            data-testid="fixtures-skeleton"
            className="grid gap-4 py-2"
          >
            {fixtureSkeletons.map((skeleton) => (
              <div
                key={skeleton}
                className="overflow-hidden rounded-lg border border-[#333] bg-[#1d1d1d]"
              >
                <div className="h-10 animate-pulse bg-[#24461a]" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-1/3 animate-pulse rounded bg-[#2a2a2a]" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-[#2a2a2a]" />
                  <div className="h-10 w-full animate-pulse rounded bg-[#2a2a2a]" />
                </div>
              </div>
            ))}
          </div>
        ) : error && fixtures.length === 0 ? (
          <div className="py-20 text-center text-[#ff3939]">
            Failed to load matches. Please try again.
          </div>
        ) : Object.keys(groupedFixtures).length === 0 ? (
          <div className="py-20 text-center text-[#c8c8c8]">
            No matches found for this selection.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {Object.entries(groupedFixtures).map(([leagueName, data]) => (
              <LeagueGroup
                key={leagueName}
                leagueName={leagueName}
                leagueLogo={data.logo}
                countryFlag={data.flag}
                fixtures={data.fixtures}
                marketView={effectiveMarketView}
                selectedMarketLabel={selectedExtraMarket?.label}
                selectedMarketHeaders={selectedExtraMarket?.sampleLabels}
              />
            ))}
          </div>
        )}
      </div>

      <Leaderboard />
    </div>
  );
}
