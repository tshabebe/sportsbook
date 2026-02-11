import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { usePreMatchFixtures, useLiveMatches, type Fixture } from '../hooks/useFootball';
import { LeagueGroup } from '../components/LeagueGroup';
import { useSearchParams } from 'react-router-dom';
import { LEAGUES } from '../data/leagues';
import { api } from '../lib/api';
import type { ApiFootballResponse } from '../types/football';

type ViewTab = 'prematch' | 'live';
type DateFilter = 'all' | 'today' | 'tomorrow' | 'next7d';

<<<<<<< HEAD
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
  const [activeTab, setActiveTab] = useState<ViewTab>('prematch');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [searchParams, setSearchParams] = useSearchParams();
  const queryLeagueId = Number(searchParams.get('league') ?? '0');
  const normalizedLeagueId = LEAGUES.some((league) => league.id === queryLeagueId) ? queryLeagueId : 0;
  const selectedLeagueId = normalizedLeagueId;

  const handleLeagueChange = (leagueId: number) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (leagueId === 0) {
      nextParams.delete('league');
    } else {
      nextParams.set('league', String(leagueId));
    }
    setSearchParams(nextParams, { replace: true });
  };
=======
export function HomePage() {
  const [activeTab, setActiveTab] = useState<ViewTab>('prematch');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [searchParams] = useSearchParams();

  // Read league from URL (set by sidebar)
  const selectedLeagueId = Number(searchParams.get('league') || 0);
>>>>>>> 01900a5e7184b373bc4e183dbc08d884bcb7bf24

  const { data: preMatchFixtures, isLoading: isLoadingPre, error: errorPre } = usePreMatchFixtures(selectedLeagueId);
  const { data: liveFixtures, isLoading: isLoadingLive } = useLiveMatches();

  const rawFixtures = activeTab === 'prematch' ? preMatchFixtures : liveFixtures;
  const isLoading = activeTab === 'prematch' ? isLoadingPre : isLoadingLive;
  const error = activeTab === 'prematch' ? errorPre : null;

  const fixtures = useMemo(() => {
    if (!rawFixtures) return [];
    let nextFixtures = rawFixtures;

    if (selectedLeagueId !== 0) {
      nextFixtures = nextFixtures.filter((fixture) => fixture.league.id === selectedLeagueId);
    }

    if (activeTab !== 'prematch' || dateFilter === 'all') return nextFixtures;

    const now = dayjs();
    return nextFixtures.filter((fixture) => {
      const at = dayjs(fixture.fixture.date);
      if (dateFilter === 'today') return at.isSame(now, 'day');
      if (dateFilter === 'tomorrow') return at.isSame(now.add(1, 'day'), 'day');
      return at.isAfter(now) && at.isBefore(now.add(7, 'day').endOf('day'));
    });
  }, [activeTab, dateFilter, rawFixtures, selectedLeagueId]);

  const groupedFixtures = useMemo(() => {
    return fixtures.reduce((groups, fixture) => {
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
    }, {} as Record<string, { fixtures: Fixture[]; logo: string; flag: string }>);
  }, [fixtures]);

  const { data: leagueAssetsResponse } = useQuery({
    queryKey: ['leagues', 'assets', LEAGUES.map((l) => l.id).join(',')],
    queryFn: async () => {
      const leagueIds = LEAGUES.filter((l) => l.id !== 0).map((l) => l.id);
      const results = await Promise.all(
        leagueIds.map((id) =>
          api.get<ApiFootballResponse<{ league?: { id: number; name: string; logo?: string; flag?: string | null } }>>('/football/leagues', {
            params: { id },
          }),
        ),
      );
      return results.flatMap((r) => r.data.response || []);
    },
    staleTime: 60 * 60 * 1000,
  });

<<<<<<< HEAD
  const leagueAssetsFromApiById = useMemo(() => {
    const items = leagueAssetsResponse || [];
    return items.reduce((acc, item) => {
      const league = item?.league;
      const id = league?.id;
      if (!id) return acc;
      acc[id] = {
        flag: league.flag ?? null,
        logo: league.logo ?? null,
        name: league.name ?? String(id),
      };
      return acc;
    }, {} as Record<number, { flag: string | null; logo: string | null; name: string }>);
  }, [leagueAssetsResponse]);

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

  const marketView = '1x2' as const;

  const leagueIconFor = (leagueId: number) => {
    switch (leagueId) {
      case 0:
        return '';
      case 39:
      case 40:
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('prematch')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  activeTab === 'prematch' ? 'bg-[#ffd60a] text-[#1d1d1d]' : 'bg-[#2a2a2a] text-[#c8c8c8]'
                }`}
              >
                Pre-Match
              </button>
              <button
                onClick={() => setActiveTab('live')}
                className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                  activeTab === 'live' ? 'bg-[#ffd60a] text-[#1d1d1d]' : 'bg-[#2a2a2a] text-[#c8c8c8]'
                }`}
              >
                Live
              </button>
            </div>

            <div className="w-[210px] sm:w-[240px]">
              <Select
                aria-label="Date filter"
                selectedKey={dateFilter}
                onSelectionChange={(key) => setDateFilter(key as DateFilter)}
                isDisabled={activeTab !== 'prematch'}
                className="w-full"
              >
                <AriaButton className="flex w-full items-center justify-between rounded-lg border border-[#333] bg-[#141414] px-3 py-2 text-sm font-semibold text-[#fafafa] disabled:opacity-60">
                  <SelectValue />
                  <span aria-hidden>▾</span>
                </AriaButton>
                <Popover className="w-(--trigger-width) rounded-lg border border-[#333] bg-[#1d1d1d] p-1 text-[#fafafa] shadow-lg data-[entering]:animate-in data-[entering]:fade-in data-[entering]:zoom-in-95 data-[exiting]:animate-out data-[exiting]:fade-out data-[exiting]:zoom-out-95">
                  <ListBox className="outline-none">
                    <ListBoxItem id="all" className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-[#2a2a2a] data-[selected]:bg-[#ffd60a] data-[selected]:text-[#1d1d1d]">All Dates</ListBoxItem>
                    <ListBoxItem id="today" className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-[#2a2a2a] data-[selected]:bg-[#ffd60a] data-[selected]:text-[#1d1d1d]">Today</ListBoxItem>
                    <ListBoxItem id="tomorrow" className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-[#2a2a2a] data-[selected]:bg-[#ffd60a] data-[selected]:text-[#1d1d1d]">Tomorrow</ListBoxItem>
                    <ListBoxItem id="next7d" className="cursor-pointer rounded px-3 py-2 text-sm outline-none transition data-[focused]:bg-[#2a2a2a] data-[selected]:bg-[#ffd60a] data-[selected]:text-[#1d1d1d]">Next 7 Days</ListBoxItem>
                  </ListBox>
                </Popover>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {LEAGUES.map((league) => (
              <button
                key={league.id}
                onClick={() => handleLeagueChange(league.id)}
                className={`shrink-0 inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold ${
                  selectedLeagueId === league.id
                    ? 'bg-[#ffd60a] text-[#1d1d1d]'
                    : 'bg-[#2a2a2a] text-[#c8c8c8] hover:bg-[#333]'
                }`}
              >
                {league.id === 0 ? (
                  <SoccerIcon />
                ) : (leagueAssetsById[league.id]?.flag || leagueAssetsById[league.id]?.logo) ? (
                  <img
                    src={(leagueAssetsById[league.id]?.flag || leagueAssetsById[league.id]?.logo) as string}
                    alt={leagueAssetsById[league.id]?.name || league.name}
                    className="h-4 w-4 rounded-sm object-contain"
                    loading="lazy"
                  />
                ) : (leagueAssetsFromApiById[league.id]?.flag || leagueAssetsFromApiById[league.id]?.logo) ? (
                  <img
                    src={(leagueAssetsFromApiById[league.id]?.flag || leagueAssetsFromApiById[league.id]?.logo) as string}
                    alt={leagueAssetsFromApiById[league.id]?.name || league.name}
                    className="h-4 w-4 rounded-sm object-contain"
                    loading="lazy"
                  />
                ) : (
                  <span aria-hidden className="text-[14px] leading-none">{leagueIconFor(league.id)}</span>
                )}
                <span className="leading-none">{league.id === 0 ? 'All' : league.name}</span>
              </button>
            ))}
          </div>
=======
      <div className="rounded-xl border border-[#333] bg-[#1d1d1d] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('prematch')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${activeTab === 'prematch' ? 'bg-[#ffd60a] text-[#1d1d1d]' : 'bg-[#2a2a2a] text-[#c8c8c8]'
              }`}
          >
            Pre-Match
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('live')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${activeTab === 'live' ? 'bg-[#ffd60a] text-[#1d1d1d]' : 'bg-[#2a2a2a] text-[#c8c8c8]'
              }`}
          >
            Live
          </button>
>>>>>>> 01900a5e7184b373bc4e183dbc08d884bcb7bf24
        </div>
      </div>

      <div className="min-h-[500px]">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#ffd60a]" />
          </div>
        ) : error ? (
          <div className="py-20 text-center text-[#ff3939]">Failed to load matches. Please try again.</div>
        ) : Object.keys(groupedFixtures).length === 0 ? (
          <div className="py-20 text-center text-[#c8c8c8]">No matches found for this selection.</div>
        ) : (
          <div className="flex flex-col gap-4">
            {Object.entries(groupedFixtures).map(([leagueName, data]) => (
              <LeagueGroup
                key={leagueName}
                leagueName={leagueName}
                leagueLogo={data.logo}
                countryFlag={data.flag}
                fixtures={data.fixtures}
                marketView={marketView}
              />
            ))}
          </div>
        )}
      </div>

      <Leaderboard />
    </div>
  );
}
