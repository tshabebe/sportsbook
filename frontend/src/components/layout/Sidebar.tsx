<<<<<<< HEAD
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LEAGUES } from '../../data/leagues';
import { usePreMatchFixtures } from '../../hooks/useFootball';

const SoccerIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    height="1em"
    viewBox="-10 0 1063 1024"
    className="h-4 w-4"
    fill="currentColor"
  >
    <path d="M339.646 35.773C276 61.233 219.424 99.42 169.921 147.507 120.418 197.01 83.646 253.584 58.186 317.232 32.727 379.464 19.999 444.525 19.999 511s12.728 131.536 38.187 192.354c25.46 63.647 63.647 120.222 111.735 169.725 49.503 49.503 106.077 86.276 169.725 111.735 60.817 25.46 125.878 36.773 192.354 36.773s131.536-12.729 192.354-36.773c63.647-25.46 120.222-63.646 169.725-111.735 49.503-49.502 86.275-106.077 111.735-169.725 25.459-60.817 36.773-125.878 36.773-192.354s-12.729-131.536-36.773-192.354C980.354 255 942.168 198.424 894.079 148.921S788.002 62.646 724.354 37.186C663.537 11.727 598.476-1 532-1S400.464 11.727 339.646 35.772zm-192.353 690.21c-24.044-15.559-46.674-33.945-67.89-53.746-31.116-86.276-35.359-179.624-15.558-268.73 9.901-18.386 19.802-36.772 32.53-53.745 5.657-7.071 8.486-11.315 12.729-16.972l115.979 67.89v2.829c0 62.232 5.657 124.464 18.386 183.867l-89.104 140.022c-2.83 1.413-4.243 0-7.072-1.414zm343.69 237.614c19.8 9.901 41.017 18.388 60.817 25.459-89.104 4.243-179.624-16.972-260.243-62.231l195.183 33.944c1.414 1.414 2.83 1.414 4.244 2.829zm0-35.359L261.856 887.22c-26.873-32.529-50.917-66.474-72.134-103.249-5.656-9.9-11.314-18.386-15.557-28.287l89.104-140.02c1.414 0 4.243 1.413 7.072 1.413 56.576 15.558 113.15 25.46 169.725 33.946 2.828 0 5.657 1.413 8.486 1.413l108.906 185.282c-18.387 25.459-36.774 52.33-56.575 77.79-2.83 5.657-7.073 8.486-9.9 12.73zm380.465-79.205c-18.388 18.387-38.188 33.944-57.99 49.503-2.828-26.873-8.486-53.746-16.971-79.204l113.148-212.155c31.116-14.144 62.232-31.116 90.52-50.917q6.364-4.244 8.485-8.486c-7.071 110.32-53.746 217.812-137.192 301.26zm-5.658-275.801c4.243 8.485 8.486 16.972 12.729 24.044l-110.32 206.497h-1.414c-59.403 11.314-120.22 16.972-181.039 16.972l-110.32-190.94c16.973-32.529 33.946-63.645 50.917-96.176 11.316-21.215 22.63-43.845 33.946-65.06l227.713-24.045c28.287 42.431 55.16 84.862 77.79 128.707zm-46.674-244.685-33.945 84.862-222.055 22.63c-2.83-2.829-5.658-7.072-8.487-9.901-26.873-29.702-52.33-59.402-79.204-89.105l1.414-1.414-32.53-32.53 62.232-186.696c4.244-1.414 8.487-1.414 12.73-2.828 33.944-2.83 67.89-7.072 100.42-9.902 21.215-1.414 41.017-1.414 62.231 0l152.751 172.552c-4.243 18.387-8.485 35.36-15.557 52.332zm52.332-156.995c42.43 42.432 74.96 90.52 97.59 141.437-28.286-19.802-59.402-35.36-91.933-49.503-5.657-1.414-9.901-4.243-15.558-5.657L710.21 88.104c2.829-5.656 2.829-14.144 2.829-21.215 57.989 24.044 111.735 57.99 158.409 104.663zM377.834 58.403q2.121 0 0 0c35.36 12.729 66.475 29.702 96.177 50.917l-57.989 173.967h-1.414c-11.315 4.243-24.043 9.902-35.359 14.144-48.088 21.216-94.762 46.675-138.608 74.96l-114.563-67.889c0-4.243 1.414-7.072 1.414-9.901 7.072-19.801 15.558-41.017 24.044-60.818 7.072-15.558 14.144-29.702 22.63-45.26 5.657-5.657 11.315-11.315 16.972-18.387 53.746-53.746 118.808-93.348 186.696-115.978 1.414 2.829 1.414 2.829 0 4.243z"></path>
  </svg>
);

export function Sidebar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const leagueParam = Number(searchParams.get('league') ?? '0');
  const activeLeagueId = LEAGUES.some((league) => league.id === leagueParam) ? leagueParam : 0;

  const fixturesQuery = usePreMatchFixtures(0);
  const fixtures = fixturesQuery.data ?? [];

  const leagueAssetsById = useMemo(() => {
    return fixtures.reduce((acc, fixture) => {
      const leagueId = fixture.league.id;
      if (!acc[leagueId]) {
        acc[leagueId] = {
          flag: fixture.league.flag || null,
          logo: fixture.league.logo || null,
          name: fixture.league.name,
        };
      }
      return acc;
    }, {} as Record<number, { flag: string | null; logo: string | null; name: string }>);
  }, [fixtures]);

  const leagueCounts = useMemo(() => {
    const counter = new Map<number, number>();
    fixtures.forEach((fixture) => {
      const leagueId = fixture.league.id;
      counter.set(leagueId, (counter.get(leagueId) ?? 0) + 1);
    });
    return counter;
  }, [fixtures]);

  const handleLeagueSelect = (leagueId: number) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (leagueId === 0) {
      nextParams.delete('league');
    } else {
      nextParams.set('league', String(leagueId));
    }
    setSearchParams(nextParams, { replace: true });
  };

  const totalMatches = fixtures.length;

  return (
    <aside className="hidden h-full w-[240px] flex-col border-r border-border-subtle bg-element-bg px-4 py-6 text-text-contrast md:flex">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#9aa3b1]">Live Leagues</p>
      <div className="mt-4 flex flex-col gap-1">
        {LEAGUES.map((league) => {
          const isActive = activeLeagueId === league.id;
          const count = league.id === 0 ? totalMatches : leagueCounts.get(league.id) ?? 0;
          return (
            <button
              key={league.id}
              onClick={() => handleLeagueSelect(league.id)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'bg-accent-solid text-accent-text-contrast shadow-sm'
                  : 'bg-[#1e1e1e] text-text-muted hover:bg-[#2a2a2a] hover:text-text-contrast'
              }`}
            >
              <span className="flex items-center gap-3 text-left">
                {league.id === 0 ? (
                  <SoccerIcon />
                ) : leagueAssetsById[league.id]?.flag || leagueAssetsById[league.id]?.logo ? (
                  <img
                    src={(leagueAssetsById[league.id]?.flag || leagueAssetsById[league.id]?.logo) as string}
                    alt={leagueAssetsById[league.id]?.name || league.name}
                    className="h-4 w-4 rounded-sm object-contain"
                    loading="lazy"
                  />
                ) : (
                  <SoccerIcon />
                )}
                {league.name}
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-normal text-text-muted">
                {count}
              </span>
            </button>
          );
        })}
=======
import { useState, useMemo } from 'react';
import { Search, Trophy, ChevronDown } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useLeagues } from '../../hooks/useLeagues';
import { usePreMatchFixtures } from '../../hooks/useFootball';

const INITIAL_VISIBLE = 10;

export function Sidebar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedLeagueId = Number(searchParams.get('league') || 0);

  const { data: leagues = [], isLoading: isLoadingLeagues } = useLeagues();
  const { data: allFixtures = [] } = usePreMatchFixtures(0);

  // Compute bettable count per league from cached fixture data
  const leaguesWithCounts = useMemo(() => {
    return leagues.map((league) => {
      const count = allFixtures.filter((f) => f.league.id === league.id).length;
      return { ...league, count };
    });
  }, [leagues, allFixtures]);

  // Filter by search
  const filteredLeagues = useMemo(() => {
    if (!searchQuery.trim()) return leaguesWithCounts;
    const q = searchQuery.toLowerCase();
    return leaguesWithCounts.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.country.toLowerCase().includes(q),
    );
  }, [leaguesWithCounts, searchQuery]);

  // Limit visible
  const visibleLeagues = showAll
    ? filteredLeagues
    : filteredLeagues.slice(0, INITIAL_VISIBLE);

  const hasMore = filteredLeagues.length > INITIAL_VISIBLE;
  const totalBettable = useMemo(
    () => leaguesWithCounts.reduce((sum, l) => sum + l.count, 0),
    [leaguesWithCounts],
  );

  const handleLeagueClick = (leagueId: number) => {
    if (leagueId === 0) {
      searchParams.delete('league');
    } else {
      searchParams.set('league', String(leagueId));
    }
    setSearchParams(searchParams, { replace: true });
  };

  return (
    <aside className="hidden h-full w-[240px] flex-col overflow-y-auto border-r border-border-subtle bg-element-bg md:flex">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
        <Trophy size={16} className="text-accent-solid" />
        <span className="text-sm font-semibold text-text-contrast">Leagues</span>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 rounded-lg bg-app-bg px-3 py-2">
          <Search size={14} className="text-text-muted" />
          <input
            type="text"
            placeholder="Search leagues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-text-contrast placeholder:text-text-muted outline-none"
          />
        </div>
      </div>

      {/* All Leagues item */}
      <button
        type="button"
        onClick={() => handleLeagueClick(0)}
        className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${selectedLeagueId === 0
            ? 'bg-accent-solid/10 text-accent-solid font-semibold'
            : 'text-text-muted hover:bg-element-hover-bg hover:text-text-contrast'
          }`}
      >
        <span className="flex items-center gap-3">
          <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold">⚽</span>
          All Leagues
        </span>
        {totalBettable > 0 && (
          <span className="rounded-full bg-accent-solid/20 px-2 py-0.5 text-[10px] font-semibold text-accent-solid">
            {totalBettable}
          </span>
        )}
      </button>

      {/* League list */}
      <div className="flex-1 overflow-y-auto">
        {isLoadingLeagues ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-accent-solid" />
          </div>
        ) : (
          <>
            {visibleLeagues.map((league) => (
              <button
                key={league.id}
                type="button"
                onClick={() => handleLeagueClick(league.id)}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors ${selectedLeagueId === league.id
                    ? 'bg-accent-solid/10 text-accent-solid font-semibold'
                    : 'text-text-muted hover:bg-element-hover-bg hover:text-text-contrast'
                  }`}
              >
                <span className="flex items-center gap-3">
                  <img
                    src={league.logo}
                    alt={league.name}
                    className="h-5 w-5 object-contain"
                  />
                  <span className="truncate">{league.name}</span>
                </span>
                {league.count > 0 && (
                  <span className="rounded-full bg-app-bg px-2 py-0.5 text-[10px] font-semibold text-text-muted">
                    {league.count}
                  </span>
                )}
              </button>
            ))}

            {/* Show More / Show Less */}
            {hasMore && !searchQuery && (
              <button
                type="button"
                onClick={() => setShowAll(!showAll)}
                className="flex w-full items-center justify-center gap-1 px-4 py-2.5 text-xs text-accent-solid transition-colors hover:text-accent-solid/80"
              >
                <span>{showAll ? 'Show Less' : `Show More (${filteredLeagues.length - INITIAL_VISIBLE})`}</span>
                <ChevronDown
                  size={12}
                  className={`transition-transform duration-200 ${showAll ? 'rotate-180' : ''}`}
                />
              </button>
            )}

            {filteredLeagues.length === 0 && searchQuery && (
              <div className="px-4 py-6 text-center text-xs text-text-muted">
                No leagues match &ldquo;{searchQuery}&rdquo;
              </div>
            )}
          </>
        )}
      </div>

      {/* Track Ticket link */}
      <div className="border-t border-border-subtle px-4 py-3">
        <a
          href="/play/track"
          className="flex items-center gap-2 text-xs text-text-muted transition-colors hover:text-text-contrast"
        >
          <Search size={12} />
          Track Ticket
        </a>
>>>>>>> 01900a5e7184b373bc4e183dbc08d884bcb7bf24
      </div>
    </aside>
  );
}
