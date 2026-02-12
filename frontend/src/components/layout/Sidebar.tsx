import { useMemo } from 'react';
import { Search } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AllLeaguesIcon } from '../ui/AllLeaguesIcon';
import { useLeagues } from '../../hooks/useLeagues';
import { useAllLeaguesPreMatchFixtures } from '../../hooks/useFootball';

export function Sidebar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const selectedLeagueId = Number(searchParams.get('league') || 0);

  const { data: leagues = [], isLoading: isLoadingLeagues } = useLeagues();
  const { data: allFixtures = [], isLoading: isLoadingFixtures } =
    useAllLeaguesPreMatchFixtures();

  const leaguesWithCounts = useMemo(() => {
    return leagues.map((league) => {
      const count = allFixtures.filter((fixture) => fixture.league.id === league.id).length;
      return { ...league, count };
    });
  }, [leagues, allFixtures]);

  const totalBettable = useMemo(
    () => leaguesWithCounts.reduce((sum, league) => sum + league.count, 0),
    [leaguesWithCounts],
  );

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
      <div className="space-y-1 border-b border-border-subtle bg-app-bg px-4 py-3 text-[11px] text-text-muted">
        <p>1. Pick a league</p>
        <p>2. Select odds in main board</p>
        <p>3. Book or place from bet slip</p>
      </div>

      <button
        type="button"
        onClick={() => handleLeagueClick(0)}
        className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors ${
          selectedLeagueId === 0
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
        {isLoadingFixtures ? (
          <span className="h-4 w-8 animate-pulse rounded bg-accent-solid/20" />
        ) : totalBettable > 0 ? (
          <span className="rounded-full bg-accent-solid/20 px-2 py-0.5 text-[10px] font-semibold text-accent-solid">
            {totalBettable}
          </span>
        ) : null}
      </button>

      <div className="flex-1 overflow-y-auto">
        {isLoadingLeagues ? (
          <div className="space-y-2 px-4 py-4">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="h-4 w-28 animate-pulse rounded bg-element-hover-bg" />
                <div className="h-4 w-8 animate-pulse rounded bg-element-hover-bg" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {leaguesWithCounts.map((league) => (
              <button
                key={league.id}
                type="button"
                onClick={() => handleLeagueClick(league.id)}
                className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm transition-colors ${
                  selectedLeagueId === league.id
                    ? 'bg-accent-solid/10 font-semibold text-accent-solid'
                    : 'text-text-muted hover:bg-element-hover-bg hover:text-text-contrast'
                }`}
              >
                <span className="flex items-center gap-3">
                  <img
                    src={league.logo}
                    alt={league.name}
                    className="h-5 w-5 object-contain"
                    loading="lazy"
                  />
                  <span className="truncate">{league.name}</span>
                </span>
                {isLoadingFixtures ? (
                  <span className="h-4 w-8 animate-pulse rounded bg-app-bg" />
                ) : league.count > 0 ? (
                  <span className="rounded-full bg-app-bg px-2 py-0.5 text-[10px] font-semibold text-text-muted">
                    {league.count}
                  </span>
                ) : null}
              </button>
            ))}
          </>
        )}
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
