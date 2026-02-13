import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AllLeaguesIcon } from '../ui/AllLeaguesIcon';
import { LEAGUES } from '../../data/leagues';
import { useAllLeaguesPreMatchFixtures, type Fixture } from '../../hooks/useFootball';

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const selectedLeagueId = Number(searchParams.get('league') || 0);
  const shouldLoadAllLeagueCounts =
    location.pathname === '/play' && selectedLeagueId === 0;

  const { data: allFixtures = [], isLoading: isLoadingFixtures } =
    useAllLeaguesPreMatchFixtures(shouldLoadAllLeagueCounts);

  const selectedLeagueCachedFixtures =
    selectedLeagueId > 0
      ? queryClient.getQueryData<Fixture[]>([
        'fixtures',
        'prematch',
        'league',
        selectedLeagueId,
      ]) ?? []
      : [];

  const countsByLeagueId = useMemo(() => {
    return allFixtures.reduce((map, fixture) => {
      const leagueId = fixture.league.id;
      map.set(leagueId, (map.get(leagueId) ?? 0) + 1);
      return map;
    }, new Map<number, number>());
  }, [allFixtures]);

  const hasGlobalLeagueCounts = allFixtures.length > 0;

  const leaguesWithCounts = useMemo(() => {
    return LEAGUES.filter((league) => league.id !== 0).map((league) => {
      const count = hasGlobalLeagueCounts
        ? (countsByLeagueId.get(league.id) ?? 0)
        : league.id === selectedLeagueId
          ? selectedLeagueCachedFixtures.length
          : undefined;

      return { ...league, count };
    });
  }, [
    countsByLeagueId,
    hasGlobalLeagueCounts,
    selectedLeagueCachedFixtures.length,
    selectedLeagueId,
  ]);

  const totalBettable = hasGlobalLeagueCounts ? allFixtures.length : undefined;

  const handleLeagueClick = (leagueId: number) => {
    const nextParams = new URLSearchParams();
    const keepKeys = ['date', 'market'] as const;
    for (const key of keepKeys) {
      const value = searchParams.get(key);
      if (value) nextParams.set(key, value);
    }

    if (leagueId === 0) {
      nextParams.delete('league');
    } else {
      nextParams.set('league', String(leagueId));
    }

    const search = nextParams.toString();
    navigate(
      {
        pathname: '/play',
        search: search ? `?${search}` : '',
      },
      { replace: true },
    );
  };

  return (
    <aside className="hidden h-full w-[240px] flex-col overflow-y-auto border-r border-border-subtle bg-element-bg md:flex">
      <div className="border-b border-border-subtle p-4 text-xs text-text-muted">
        <ol className="list-decimal list-inside space-y-1">
          <li>Pick a league</li>
          <li>Select odds in main board</li>
          <li>Book or place from bet slip</li>
        </ol>
      </div>
      <button
        type="button"
        onClick={() => handleLeagueClick(0)}
        className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${selectedLeagueId === 0
          ? 'bg-accent-solid/10 font-semibold text-accent-solid'
          : 'text-text-muted hover:bg-element-hover-bg hover:text-text-contrast'
          }`}
      >
        <span className="flex items-center gap-3">
          <span className="flex h-5 w-5 items-center justify-center rounded">
            <AllLeaguesIcon className="h-4 w-4" />
          </span>
          All Leagues
        </span>
        {shouldLoadAllLeagueCounts && isLoadingFixtures ? (
          <span className="h-4 w-8 animate-pulse rounded bg-accent-solid/20" />
        ) : totalBettable !== undefined ? (
          <span className="rounded-full bg-accent-solid/20 px-2 py-0.5 text-[10px] font-semibold text-accent-solid">
            {totalBettable}
          </span>
        ) : null}
      </button>

      <div className="flex-1 overflow-y-auto">
        {leaguesWithCounts.map((league) => (
          <button
            key={league.id}
            type="button"
            onClick={() => handleLeagueClick(league.id)}
            className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors ${selectedLeagueId === league.id
              ? 'bg-accent-solid/10 font-semibold text-accent-solid'
              : 'text-text-muted hover:bg-element-hover-bg hover:text-text-contrast'
              }`}
          >
            <span className="flex items-center gap-3">
              <img
                src={league.logo || league.flag}
                alt={league.name}
                className="h-5 w-5 object-contain"
                loading="lazy"
              />
              <span className="truncate">{league.name}</span>
            </span>
            {shouldLoadAllLeagueCounts && isLoadingFixtures ? (
              <span className="h-4 w-8 animate-pulse rounded bg-app-bg" />
            ) : league.count !== undefined ? (
              <span className="rounded-full bg-app-bg px-2 py-0.5 text-[10px] font-semibold text-text-muted">
                {league.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="border-t border-border-subtle px-4 py-3">
        <a
          href="/play/track"
          className="flex items-center gap-2 text-xs text-text-muted transition-colors hover:text-text-contrast"
        >
          <Search size={12} />
          Track Ticket
        </a>
      </div>
    </aside>
  );
}
