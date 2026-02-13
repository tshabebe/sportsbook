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

import { AllLeaguesIcon } from '../components/ui/AllLeaguesIcon';
import {
  useAllLeaguesPreMatchFixtures,
  usePreMatchFixtures,
  type Fixture,
  type FixtureMarket,
} from '../hooks/useFootball';
import { useHorizontalDragScroll } from '../hooks/useHorizontalDragScroll';
import { LeagueGroup } from '../components/LeagueGroup';
import { LEAGUES } from '../data/leagues';

type DateFilter = 'all' | 'next3h' | 'future' | 'today' | 'tomorrow' | 'next7d';
type CoreMarketView = '1x2' | 'double_chance' | 'over_under';
type ExtraMarketView = `extra_${number}`;
type MarketView = CoreMarketView | ExtraMarketView;
type ExtraMarketOption = {
  id: number;
  key: ExtraMarketView;
  label: string;
  columnLabels: string[];
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

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const dateParam = searchParams.get('date');
  const dateFilter: DateFilter =
    dateParam === 'next3h' ||
      dateParam === 'future' ||
      dateParam === 'today' ||
      dateParam === 'tomorrow' ||
      dateParam === 'next7d'
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

    const now = dayjs();
    if (dateFilter === 'all') return nextFixtures;

    return nextFixtures.filter((fixture) => {
      const at = dayjs(fixture.fixture.date);
      if (dateFilter === 'next3h') {
        return at.isAfter(now) && at.isBefore(now.add(3, 'hour').add(1, 'minute'));
      }
      if (dateFilter === 'future') return at.isAfter(now);
      if (dateFilter === 'today') return at.isSame(now, 'day');
      if (dateFilter === 'tomorrow') return at.isSame(now.add(1, 'day'), 'day');
      return at.isAfter(now) && at.isBefore(now.add(7, 'day').endOf('day'));
    });
  }, [dateFilter, rawFixtures, selectedLeagueId]);

  const extraMarketOptions = useMemo<ExtraMarketOption[]>(() => {
    const optionMap = new Map<
      number,
      {
        id: number;
        key: ExtraMarketView;
        label: string;
        fixtureCount: number;
        labelStats: Map<string, { count: number; firstSeen: number }>;
      }
    >();
    let orderCounter = 0;

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
          const labelStats = new Map<string, { count: number; firstSeen: number }>();
          selectableValues.forEach((value) => {
            const label = formatMarketOutcomeLabel(value);
            labelStats.set(label, { count: 1, firstSeen: orderCounter++ });
          });
          optionMap.set(market.id, {
            id: market.id,
            key: `extra_${market.id}` as ExtraMarketView,
            label: market.name,
            fixtureCount: 1,
            labelStats,
          });
          return;
        }

        existing.fixtureCount += 1;
        selectableValues.forEach((value) => {
          const label = formatMarketOutcomeLabel(value);
          const stat = existing.labelStats.get(label);
          if (stat) {
            stat.count += 1;
            return;
          }
          existing.labelStats.set(label, { count: 1, firstSeen: orderCounter++ });
        });
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
        columnLabels: Array.from(option.labelStats.entries())
          .sort(
            ([, a], [, b]) =>
              b.count - a.count || a.firstSeen - b.firstSeen,
          )
          .slice(0, 3)
          .map(([label]) => label),
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

  const leagueCountSource = useMemo(
    () =>
      allLeaguesQuery.data && allLeaguesQuery.data.length > 0
        ? allLeaguesQuery.data
        : preMatchFixtures,
    [allLeaguesQuery.data, preMatchFixtures],
  );

  const leagueCounts = useMemo(() => {
    return leagueCountSource.reduce((map, fixture) => {
      const leagueId = fixture.league.id;
      map.set(leagueId, (map.get(leagueId) ?? 0) + 1);
      return map;
    }, new Map<number, number>());
  }, [leagueCountSource]);

  const hasGlobalLeagueCounts = selectedLeagueId === 0 || Boolean(allLeaguesQuery.data?.length);

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
  const {
    containerRef: leagueTabsRef,
    isDragging: isLeagueTabsDragging,
    onMouseDown: handleLeagueTabsMouseDown,
    onMouseMove: handleLeagueTabsMouseMove,
    onMouseUp: handleLeagueTabsMouseUp,
    onMouseLeave: handleLeagueTabsMouseLeave,
    onClickCapture: handleLeagueTabsClickCapture,
  } = useHorizontalDragScroll<HTMLDivElement>();



  return (
    <div className="flex w-full justify-center">
      <div className="flex w-full max-w-[1200px] flex-col gap-4 pb-20 md:pb-0">
        <div className="rounded-xl border border-border-subtle bg-element-bg p-2.5">
          <div className="flex flex-col gap-2">
            <div
              ref={leagueTabsRef}
              data-testid="league-tabs-scroll"
              onMouseDown={handleLeagueTabsMouseDown}
              onMouseMove={handleLeagueTabsMouseMove}
              onMouseUp={handleLeagueTabsMouseUp}
              onMouseLeave={handleLeagueTabsMouseLeave}
              onClickCapture={handleLeagueTabsClickCapture}
              className={`flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${isLeagueTabsDragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
            >
              {LEAGUES.map((league) => {
                const isActive = selectedLeagueId === league.id;
                const knownCount =
                  league.id === 0
                    ? hasGlobalLeagueCounts
                      ? leagueCountSource.length
                      : undefined
                    : hasGlobalLeagueCounts || selectedLeagueId === league.id
                      ? leagueCounts.get(league.id) ?? 0
                      : undefined;


                return (
                  <button
                    key={league.id}
                    type="button"
                    data-testid={`league-pill-${league.id}`}
                    onClick={() => handleLeagueChange(league.id)}
                    className={`shrink-0 flex items-center justify-center transition-all
                    ${isActive
                        ? 'border-accent-solid bg-accent-solid text-accent-text-contrast'
                        : 'border-transparent bg-element-hover-bg text-text-muted hover:bg-element-bg hover:text-text-contrast'}
                    
                    /* Mobile: Square Icon Style */
                    flex-col w-14 h-14 rounded-2xl border-2
                    
                    /* Desktop: Pill Style */
                    md:flex-row md:w-auto md:h-auto md:gap-2 md:rounded-md md:px-3.5 md:py-2 md:border-0
                  `}
                  >
                    {league.id === 0 ? (
                      <AllLeaguesIcon className={`h-8 w-8 md:h-4 md:w-4 ${isActive ? 'text-accent-text-contrast' : 'text-text-contrast md:text-current'}`} />
                    ) : league.logo ? (
                      <img
                        src={league.logo}
                        alt={league.name}
                        className={`h-8 w-8 md:h-4 md:w-4 object-contain transition-all bg-white rounded-full p-1`}
                      />
                    ) : league.flag ? (
                      <img
                        src={league.flag}
                        alt={league.name}
                        className={`h-8 w-8 md:h-4 md:w-4 object-contain transition-all bg-white rounded-full p-1`}
                      />
                    ) : (
                      <span className="text-xl md:text-[14px]">⚽</span>
                    )}

                    <span className="hidden md:block leading-none">{league.id === 0 ? 'All' : league.name}</span>

                    {knownCount !== undefined ? (
                      <span className={`hidden md:block rounded-full px-1.5 py-0.5 text-[11px] font-medium ${isActive ? 'bg-accent-text-contrast/20 text-accent-text-contrast' : 'bg-app-bg text-text-muted'}`}>
                        {knownCount}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
              <div className="w-full min-w-0 md:flex-1">
                <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {marketOptions.map((option) => {
                    const isActive = effectiveMarketView === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        data-testid={`market-tab-${option.key}`}
                        onClick={() => updateParam('market', option.key, '1x2')}
                        className={`shrink-0 rounded-md px-3.5 py-2 text-sm font-semibold ${isActive
                          ? 'bg-success-solid text-accent-text-contrast'
                          : 'bg-element-hover-bg text-text-muted hover:bg-element-bg hover:text-text-contrast'
                          }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex w-full gap-2 md:w-auto">
                <div className="flex-1 md:w-[170px] md:flex-none">
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
                      className="flex w-full items-center justify-between rounded-lg border border-border-subtle bg-app-bg px-3 py-2 text-sm font-semibold text-text-contrast disabled:opacity-60"
                    >
                      <SelectValue />
                      <span aria-hidden>▾</span>
                    </AriaButton>
                    <Popover className="min-w-[var(--trigger-width)] rounded-lg border border-border-subtle bg-element-bg p-1 text-text-contrast shadow-lg data-[entering]:animate-in data-[entering]:fade-in data-[entering]:zoom-in-95 data-[exiting]:animate-out data-[exiting]:fade-out data-[exiting]:zoom-out-95">
                      <ListBox className="outline-none">
                        <ListBoxItem
                          id="all"
                          className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-element-hover-bg data-[selected]:bg-accent-solid data-[selected]:text-accent-text-contrast"
                        >
                          All Dates
                        </ListBoxItem>
                        <ListBoxItem
                          id="next3h"
                          className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-element-hover-bg data-[selected]:bg-accent-solid data-[selected]:text-accent-text-contrast"
                        >
                          In 3 Hours
                        </ListBoxItem>
                        <ListBoxItem
                          id="future"
                          className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-element-hover-bg data-[selected]:bg-accent-solid data-[selected]:text-accent-text-contrast"
                        >
                          Future
                        </ListBoxItem>
                        <ListBoxItem
                          id="today"
                          className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-element-hover-bg data-[selected]:bg-accent-solid data-[selected]:text-accent-text-contrast"
                        >
                          Today
                        </ListBoxItem>
                        <ListBoxItem
                          id="tomorrow"
                          className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-element-hover-bg data-[selected]:bg-accent-solid data-[selected]:text-accent-text-contrast"
                        >
                          Tomorrow
                        </ListBoxItem>
                        <ListBoxItem
                          id="next7d"
                          className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-element-hover-bg data-[selected]:bg-accent-solid data-[selected]:text-accent-text-contrast"
                        >
                          Next 7 Days
                        </ListBoxItem>
                      </ListBox>
                    </Popover>
                  </Select>
                </div>

                <div className="flex-1 md:w-[190px] md:flex-none">
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
                      className="flex w-full items-center justify-between rounded-lg border border-border-subtle bg-app-bg px-3 py-2 text-sm font-semibold text-text-contrast disabled:opacity-60"
                    >
                      <SelectValue />
                      <span aria-hidden>▾</span>
                    </AriaButton>
                    <Popover className="min-w-[var(--trigger-width)] rounded-lg border border-border-subtle bg-element-bg p-1 text-text-contrast shadow-lg data-[entering]:animate-in data-[entering]:fade-in data-[entering]:zoom-in-95 data-[exiting]:animate-out data-[exiting]:fade-out data-[exiting]:zoom-out-95">
                      <ListBox className="outline-none">
                        <ListBoxItem
                          id="none"
                          data-testid="extra-market-option-none"
                          className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-element-hover-bg data-[selected]:bg-accent-solid data-[selected]:text-accent-text-contrast"
                        >
                          More Markets
                        </ListBoxItem>
                        {extraMarketOptions.length === 0 ? (
                          <ListBoxItem
                            id="no-extra-markets"
                            isDisabled
                            className="cursor-not-allowed rounded px-3 py-2 text-sm text-text-muted"
                          >
                            No extra markets available
                          </ListBoxItem>
                        ) : (
                          extraMarketOptions.map((option) => (
                            <ListBoxItem
                              key={option.key}
                              id={option.key}
                              data-testid={`extra-market-option-${option.id}`}
                              className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-element-hover-bg data-[selected]:bg-accent-solid data-[selected]:text-accent-text-contrast"
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

              {selectedLeagueId === 0 && isFetchingPre ? (
                <p className="text-right text-xs text-text-muted">Loading more leagues...</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="min-h-[500px]">
          <div className="flex flex-col gap-2">
            {isFetchingPre && fixtures.length > 0 ? (
              <p className="text-xs text-text-muted">Refreshing odds...</p>
            ) : null}
            {isLoading && fixtures.length === 0 ? (
              <div
                data-testid="fixtures-skeleton"
                className="flex flex-col gap-4 py-2"
              >
                {fixtureSkeletons.map((skeleton) => (
                  <div
                    key={skeleton}
                    className="overflow-hidden rounded-lg border border-border-subtle bg-element-bg"
                  >
                    <div className="h-10 animate-pulse bg-success-solid/30" />
                    <div className="flex flex-col gap-2 p-4">
                      <div className="h-4 w-1/3 animate-pulse rounded bg-element-hover-bg" />
                      <div className="h-4 w-2/3 animate-pulse rounded bg-element-hover-bg" />
                      <div className="h-10 w-full animate-pulse rounded bg-element-hover-bg" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error && fixtures.length === 0 ? (
              <div className="py-20 text-center text-status-negative">
                Failed to load matches. Please try again.
              </div>
            ) : Object.keys(groupedFixtures).length === 0 ? (
              <div className="py-20 text-center text-text-muted">
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
                    selectedMarketHeaders={selectedExtraMarket?.columnLabels}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
