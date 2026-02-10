import { useMemo, useState } from 'react';
import {
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  Button as AriaButton,
} from 'react-aria-components';
import dayjs from 'dayjs';
import { Leaderboard } from '../components/Leaderboard';
import { PromotionsCarousel } from '../components/PromotionsCarousel';
import { usePreMatchFixtures, useLiveMatches, type Fixture } from '../hooks/useFootball';
import { LeagueGroup } from '../components/LeagueGroup';

type ViewTab = 'prematch' | 'live';
type DateFilter = 'all' | 'today' | 'tomorrow' | 'next7d';

const LEAGUES = [
  { id: 0, name: 'All Leagues' },
  { id: 39, name: 'Premier League' },
  { id: 40, name: 'Championship' },
  { id: 88, name: 'Eredivisie' },
  { id: 61, name: 'Ligue 1' },
  { id: 78, name: 'Bundesliga' },
  { id: 135, name: 'Serie A' },
  { id: 140, name: 'La Liga' },
] as const;

export function HomePage() {
  const [activeTab, setActiveTab] = useState<ViewTab>('prematch');
  const [selectedLeagueId, setSelectedLeagueId] = useState<number>(0);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

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

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 pb-20 md:pb-0">
      <PromotionsCarousel />

      <div className="rounded-xl border border-[#333] bg-[#1d1d1d] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('prematch')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              activeTab === 'prematch' ? 'bg-[#ffd60a] text-[#1d1d1d]' : 'bg-[#2a2a2a] text-[#c8c8c8]'
            }`}
          >
            Pre-Match
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              activeTab === 'live' ? 'bg-[#ffd60a] text-[#1d1d1d]' : 'bg-[#2a2a2a] text-[#c8c8c8]'
            }`}
          >
            Live
          </button>
          <span className="ml-auto text-[11px] font-semibold uppercase tracking-wide text-[#c8c8c8]">League</span>
          <div className="flex flex-wrap gap-1.5">
            {LEAGUES.map((league) => (
              <button
                key={league.id}
                onClick={() => setSelectedLeagueId(league.id)}
                className={`rounded-md px-2.5 py-1 text-[11px] ${
                  selectedLeagueId === league.id ? 'bg-[#ffd60a] text-[#1d1d1d]' : 'bg-[#2a2a2a] text-[#c8c8c8]'
                }`}
              >
                {league.id === 0 ? 'All' : league.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Select
          aria-label="Date filter"
          selectedKey={dateFilter}
          onSelectionChange={(key) => setDateFilter(key as DateFilter)}
          isDisabled={activeTab !== 'prematch'}
          className="w-full"
        >
          <AriaButton className="flex w-full items-center justify-between rounded-lg border border-[#333] bg-[#1d1d1d] px-4 py-2 text-sm text-[#fafafa] disabled:opacity-60">
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
              />
            ))}
          </div>
        )}
      </div>

      <Leaderboard />
    </div>
  );
}
