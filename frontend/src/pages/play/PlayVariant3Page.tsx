import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { CalendarDays, ChevronDown, ChevronsUpDown, SlidersHorizontal, X } from 'lucide-react';
import { usePlayShowcaseData } from './usePlayShowcaseData';

type TimeFilter = 'all' | '3h' | 'today' | 'tomorrow' | 'weekend' | 'future';

function timeLabel(dateIso: string): string {
  const d = dayjs(dateIso);
  const now = dayjs();
  if (d.isSame(now, 'day')) return `Today ${d.format('HH:mm')}`;
  if (d.isSame(now.add(1, 'day'), 'day')) return `Tomorrow ${d.format('HH:mm')}`;
  return d.format('MMM D, HH:mm');
}

function passesTimeFilter(dateIso: string, filter: TimeFilter): boolean {
  const d = dayjs(dateIso);
  const now = dayjs();

  if (filter === 'all') return true;
  if (filter === '3h') return d.isAfter(now) && d.isBefore(now.add(3, 'hour'));
  if (filter === 'today') return d.isSame(now, 'day');
  if (filter === 'tomorrow') return d.isSame(now.add(1, 'day'), 'day');
  if (filter === 'weekend') {
    const day = d.day();
    return day === 0 || day === 6;
  }
  if (filter === 'future') return d.isAfter(now.add(2, 'day'));
  return true;
}

function LayoutSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-12 rounded-lg bg-element-hover-bg" />
      <div className="h-14 rounded-lg bg-element-hover-bg" />
      <div className="h-10 rounded-lg bg-element-hover-bg" />
      <div className="h-12 rounded-lg bg-element-hover-bg" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-20 rounded-lg bg-element-hover-bg" />
      ))}
    </div>
  );
}

export function PlayVariant3Page() {
  const { prematch, isLoading } = usePlayShowcaseData();
  const [leagueFilter, setLeagueFilter] = useState<string>('Premier League');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  const availableLeagues = useMemo(() => {
    const names = Array.from(new Set(prematch.map((f) => f.league.name)));
    const preferred = [
      'Premier League',
      'Championship',
      'Eredivisie',
      'Ligue 1',
      'Bundesliga',
      'Serie A',
      'La Liga',
    ];
    const prioritized = preferred.filter((name) => names.includes(name));
    const fallback = names.filter((name) => !prioritized.includes(name));
    return [...prioritized, ...fallback];
  }, [prematch]);

  const events = useMemo(() => {
    return prematch
      .filter((f) => (leagueFilter ? f.league.name === leagueFilter : true))
      .filter((f) => passesTimeFilter(f.fixture.date, timeFilter))
      .slice(0, 30);
  }, [prematch, leagueFilter, timeFilter]);

  const leagueName = leagueFilter || events[0]?.league.name || 'Events';
  const country = events[0]?.league.country || '';

  if (isLoading) return <LayoutSkeleton />;

  return (
    <section className="space-y-3">
      <div className="rounded-lg border border-border-subtle bg-element-bg p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-accent-solid px-3 py-1.5 text-xs font-semibold text-accent-text-contrast">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {leagueFilter || 'Tournament'}
            {leagueFilter ? (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setLeagueFilter('');
                }}
                className="rounded bg-black/20 p-0.5"
                role="button"
              >
                <X className="h-3 w-3" />
              </span>
            ) : null}
          </button>

          <button className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-app-bg px-3 py-1.5 text-xs font-medium text-text-muted">
            <ChevronsUpDown className="h-3.5 w-3.5" />
            Odds
            <ChevronDown className="h-3.5 w-3.5" />
          </button>

          <button className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-app-bg px-3 py-1.5 text-xs font-medium text-text-muted">
            <CalendarDays className="h-3.5 w-3.5" />
            Time
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {availableLeagues.slice(0, 7).map((name) => (
            <button
              key={name}
              onClick={() => setLeagueFilter(name)}
              className={`rounded-md px-2.5 py-1 text-[11px] ${leagueFilter === name ? 'bg-accent-solid text-accent-text-contrast' : 'bg-app-bg text-text-muted'}`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border-subtle bg-element-bg p-2.5">
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {([
            ['all', 'All Events'],
            ['3h', '3 Hours'],
            ['today', 'Today'],
            ['tomorrow', 'Tomorrow'],
            ['weekend', 'Weekend'],
            ['future', 'Future'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTimeFilter(key)}
              className={`rounded-md px-2.5 py-1 ${timeFilter === key ? 'bg-accent-solid text-accent-text-contrast' : 'bg-app-bg text-text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border-subtle bg-element-bg">
        <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold text-text-contrast">{leagueName}</p>
            <p className="text-xs text-text-muted">{country}</p>
          </div>
          <div className="grid grid-cols-3 gap-1 text-[11px] font-semibold text-text-muted">
            <span className="w-12 text-center">1</span>
            <span className="w-12 text-center">X</span>
            <span className="w-12 text-center">2</span>
          </div>
        </div>

        <div>
          {events.map((event, idx) => (
            <div key={event.fixture.id} className="border-b border-border-subtle last:border-b-0">
              <Link to={`/play/fixture/${event.fixture.id}`} className="flex items-stretch justify-between gap-2 px-3 py-2.5 hover:bg-element-hover-bg">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-contrast">{event.teams.home.name}</div>
                  <div className="text-sm font-medium text-text-contrast">{event.teams.away.name}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-text-muted">
                    <span>{String(event.fixture.id).slice(-4)} |</span>
                    <span>{timeLabel(event.fixture.date)}</span>
                    <span className="rounded bg-app-bg px-1.5 py-0.5">+{600 + ((event.fixture.id + idx) % 2800)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 self-center text-xs">
                  <span className="w-12 rounded bg-app-bg px-1.5 py-1.5 text-center font-semibold">{event.odds.home}</span>
                  <span className="w-12 rounded bg-app-bg px-1.5 py-1.5 text-center font-semibold">{event.odds.draw}</span>
                  <span className="w-12 rounded bg-app-bg px-1.5 py-1.5 text-center font-semibold">{event.odds.away}</span>
                </div>
              </Link>
            </div>
          ))}

          {events.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-text-muted">No events to display</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
