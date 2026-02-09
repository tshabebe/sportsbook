import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, Flame, ListFilter, MapPin, Timer } from 'lucide-react';
import { api } from '../../lib/api';
import { useBetSlip } from '../../context/BetSlipContext';
import { formatFixtureTime, formatKickoffRelative } from '../../lib/date';
import { usePlayShowcaseData } from './usePlayShowcaseData';

type OddsLayout = 'classic' | 'probability' | 'stacked' | 'compact' | 'spotlight';

type IterationConfig = {
  label: string;
  title: string;
  subtitle: string;
  emphasizeLive: boolean;
  compactRows: boolean;
  splitLayout: boolean;
  showTopLeagues: boolean;
  showTrending: boolean;
  oddsLayout: OddsLayout;
};

type ShowcaseFixture = {
  fixture: {
    id: number;
    date: string;
    status: { short: string; long: string; elapsed: number | null };
    venue: { city: string; name: string };
  };
  league: { name: string; round?: string };
  teams: { home: { name: string }; away: { name: string } };
  goals: { home: number | null; away: number | null };
  odds: { home: string; draw: string; away: string };
};

type PredictionResponse = {
  response?: Array<{
    predictions?: {
      advice?: string;
      percent?: { home?: string; draw?: string; away?: string };
    };
  }>;
};

function IterationSkeleton({ splitLayout }: { splitLayout: boolean }) {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-24 rounded-2xl bg-element-hover-bg" />
      <div className="h-12 rounded-xl bg-element-hover-bg" />
      {splitLayout ? (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="h-[560px] rounded-2xl bg-element-hover-bg" />
          <div className="h-[560px] rounded-2xl bg-element-hover-bg" />
        </div>
      ) : (
        <div className="h-[560px] rounded-2xl bg-element-hover-bg" />
      )}
    </div>
  );
}

const toProbability = (odd: string): number => {
  const n = Number(odd);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return (1 / n) * 100;
};

function StatusPill({ fixture }: { fixture: ShowcaseFixture }) {
  const status = fixture.fixture.status.short;
  if (status === 'NS') {
    return <span className="rounded-full bg-app-bg px-2 py-0.5 text-[11px] text-text-muted">{formatKickoffRelative(fixture.fixture.date)}</span>;
  }

  const score = `${fixture.goals.home ?? 0}-${fixture.goals.away ?? 0}`;
  return (
    <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] text-red-500">
      LIVE {fixture.fixture.status.elapsed ? `${fixture.fixture.status.elapsed}'` : ''} {score}
    </span>
  );
}

const selectionIdFor = (fixture: ShowcaseFixture, value: 'Home' | 'Draw' | 'Away') =>
  `${fixture.fixture.id}-mw-1-${value}`;

function OddsLayoutBlock({
  fixture,
  layout,
  isSelected,
  onSelect,
}: {
  fixture: ShowcaseFixture;
  layout: OddsLayout;
  isSelected: (value: 'Home' | 'Draw' | 'Away') => boolean;
  onSelect: (value: 'Home' | 'Draw' | 'Away') => void;
}) {
  const homeProb = toProbability(fixture.odds.home);
  const drawProb = toProbability(fixture.odds.draw);
  const awayProb = toProbability(fixture.odds.away);

  if (layout === 'probability') {
    return (
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs">
        {[
          { key: '1', value: 'Home' as const, odd: fixture.odds.home, p: homeProb },
          { key: 'X', value: 'Draw' as const, odd: fixture.odds.draw, p: drawProb },
          { key: '2', value: 'Away' as const, odd: fixture.odds.away, p: awayProb },
        ].map((row) => (
          <button
            key={row.key}
            onClick={() => onSelect(row.value)}
            className={`rounded-md border px-2 py-1.5 ${isSelected(row.value) ? 'border-accent-solid bg-accent-solid text-accent-text-contrast' : 'border-border-subtle bg-app-bg'}`}
          >
            <div className="flex items-center justify-between">
              <span>{row.key}</span>
              <span className="font-semibold">{row.odd}</span>
            </div>
            <div className="mt-1 h-1.5 rounded bg-element-hover-bg">
              <div className="h-1.5 rounded bg-accent-solid" style={{ width: `${Math.min(100, row.p)}%` }} />
            </div>
          </button>
        ))}
      </div>
    );
  }

  if (layout === 'stacked') {
    return (
      <div className="mt-2 space-y-1.5 text-xs">
        {[{ key: 'Home' as const, odd: fixture.odds.home }, { key: 'Draw' as const, odd: fixture.odds.draw }, { key: 'Away' as const, odd: fixture.odds.away }].map((row) => (
          <button
            key={row.key}
            onClick={() => onSelect(row.key)}
            className={`flex items-center justify-between rounded-md px-2.5 py-2 ${isSelected(row.key) ? 'bg-accent-solid text-accent-text-contrast' : 'bg-app-bg hover:bg-accent-solid hover:text-accent-text-contrast'}`}
          >
            <span>{row.key}</span>
            <span className="font-semibold">{row.odd}</span>
          </button>
        ))}
      </div>
    );
  }

  if (layout === 'spotlight') {
    const max = Math.max(Number(fixture.odds.home), Number(fixture.odds.draw), Number(fixture.odds.away));
    return (
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs">
        {[
          { key: '1', value: 'Home' as const, odd: fixture.odds.home },
          { key: 'X', value: 'Draw' as const, odd: fixture.odds.draw },
          { key: '2', value: 'Away' as const, odd: fixture.odds.away },
        ].map((row) => (
          <button
            key={row.key}
            onClick={() => onSelect(row.value)}
            className={`rounded-md px-2 py-1.5 text-center ${isSelected(row.value) ? 'bg-accent-solid text-accent-text-contrast' : Number(row.odd) === max ? 'bg-accent-solid/35' : 'bg-app-bg'}`}
          >
            <div>{row.key}</div>
            <div className="font-semibold">{row.odd}</div>
          </button>
        ))}
      </div>
    );
  }

  if (layout === 'compact') {
    return (
      <div className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
        <button onClick={() => onSelect('Home')} className={`rounded px-2 py-1 text-center ${isSelected('Home') ? 'bg-accent-solid text-accent-text-contrast' : 'bg-app-bg'}`}>1 {fixture.odds.home}</button>
        <button onClick={() => onSelect('Draw')} className={`rounded px-2 py-1 text-center ${isSelected('Draw') ? 'bg-accent-solid text-accent-text-contrast' : 'bg-app-bg'}`}>X {fixture.odds.draw}</button>
        <button onClick={() => onSelect('Away')} className={`rounded px-2 py-1 text-center ${isSelected('Away') ? 'bg-accent-solid text-accent-text-contrast' : 'bg-app-bg'}`}>2 {fixture.odds.away}</button>
      </div>
    );
  }

  return (
    <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs">
      <button onClick={() => onSelect('Home')} className={`rounded-md px-2 py-1.5 text-center ${isSelected('Home') ? 'bg-accent-solid text-accent-text-contrast' : 'bg-app-bg hover:bg-accent-solid hover:text-accent-text-contrast'}`}>1 {fixture.odds.home}</button>
      <button onClick={() => onSelect('Draw')} className={`rounded-md px-2 py-1.5 text-center ${isSelected('Draw') ? 'bg-accent-solid text-accent-text-contrast' : 'bg-app-bg hover:bg-accent-solid hover:text-accent-text-contrast'}`}>X {fixture.odds.draw}</button>
      <button onClick={() => onSelect('Away')} className={`rounded-md px-2 py-1.5 text-center ${isSelected('Away') ? 'bg-accent-solid text-accent-text-contrast' : 'bg-app-bg hover:bg-accent-solid hover:text-accent-text-contrast'}`}>2 {fixture.odds.away}</button>
    </div>
  );
}

function MatchRow({
  fixture,
  compact,
  oddsLayout,
  isSelected,
  onSelect,
}: {
  fixture: ShowcaseFixture;
  compact: boolean;
  oddsLayout: OddsLayout;
  isSelected: (value: 'Home' | 'Draw' | 'Away') => boolean;
  onSelect: (value: 'Home' | 'Draw' | 'Away') => void;
}) {
  return (
    <div className={`rounded-xl border border-border-subtle bg-element-bg transition hover:border-accent-solid/40 hover:bg-element-hover-bg ${compact ? 'p-2.5' : 'p-3.5'}`}>
      <div className="flex items-center justify-between text-[11px] text-text-muted">
        <span className="truncate">{fixture.league.name}{fixture.league.round ? ` • ${fixture.league.round}` : ''}</span>
        <StatusPill fixture={fixture} />
      </div>
      <div className={`mt-1 font-semibold text-text-contrast ${compact ? 'text-sm' : 'text-[15px]'}`}>
        <span className="truncate">{fixture.teams.home.name}</span>
        <span className="mx-2 text-text-muted">vs</span>
        <span className="truncate">{fixture.teams.away.name}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-text-muted">
        <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{fixture.fixture.venue.city || fixture.fixture.venue.name || 'TBD venue'}</span>
        <span className="inline-flex items-center gap-1"><Timer className="h-3 w-3" />{formatFixtureTime(fixture.fixture.date)}</span>
      </div>
      <OddsLayoutBlock fixture={fixture} layout={oddsLayout} isSelected={isSelected} onSelect={onSelect} />
      <Link to={`/play/fixture/${fixture.fixture.id}`} className="mt-2 inline-block text-[11px] font-medium text-accent-solid hover:underline">
        More markets
      </Link>
    </div>
  );
}

export function SportsbookIteration({ config }: { config: IterationConfig }) {
  const { addToBetSlip, bets } = useBetSlip();
  const { prematch, live, leagueBuckets, nextKickoff, isLoading } = usePlayShowcaseData();
  const [view, setView] = useState<'prematch' | 'live'>(config.emphasizeLive ? 'live' : 'prematch');
  const [leagueFilter, setLeagueFilter] = useState<string>('all');

  const source = view === 'live' ? (live as ShowcaseFixture[]) : (prematch as ShowcaseFixture[]);
  const leagues = useMemo(() => {
    const preferred = [
      'Premier League',
      'Championship',
      'Eredivisie',
      'Ligue 1',
      'Bundesliga',
      'Serie A',
      'La Liga',
    ];
    const available = new Set(source.map((f) => f.league.name));
    const prioritized = preferred.filter((name) => available.has(name));
    const fallback = Array.from(available).filter((name) => !preferred.includes(name)).slice(0, 4);
    return ['all', ...prioritized, ...fallback];
  }, [source]);
  const filtered = useMemo(
    () => source.filter((f) => leagueFilter === 'all' || f.league.name === leagueFilter).slice(0, 20),
    [source, leagueFilter],
  );

  const featuredFixture = filtered[0] ?? nextKickoff;
  const predictionQuery = useQuery({
    queryKey: ['featured-prediction', featuredFixture?.fixture.id],
    queryFn: async () => {
      const { data } = await api.get<PredictionResponse>('/football/predictions', {
        params: { fixture: featuredFixture?.fixture.id },
      });
      return data.response?.[0]?.predictions;
    },
    enabled: Boolean(featuredFixture?.fixture.id),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <IterationSkeleton splitLayout={config.splitLayout} />;

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border-subtle bg-element-bg p-4">
        <p className="text-[11px] uppercase tracking-[0.25em] text-text-muted">{config.label}</p>
        <h1 className="mt-1 text-2xl font-bold text-text-contrast">{config.title}</h1>
        <p className="mt-1 text-sm text-text-muted">{config.subtitle}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-app-bg px-3 py-1">Live {live.length}</span>
          <span className="rounded-full bg-app-bg px-3 py-1">Pre-match {prematch.length}</span>
          <span className="rounded-full bg-app-bg px-3 py-1">Leagues {leagueBuckets.length}</span>
          {nextKickoff ? (
            <span className="rounded-full bg-accent-solid/20 px-3 py-1 text-accent-solid">
              Next kickoff {formatKickoffRelative(nextKickoff.fixture.date)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-border-subtle bg-element-bg p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setView('prematch')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${view === 'prematch' ? 'bg-accent-solid text-accent-text-contrast' : 'bg-app-bg text-text-muted'}`}>Pre-Match</button>
          <button onClick={() => setView('live')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${view === 'live' ? 'bg-accent-solid text-accent-text-contrast' : 'bg-app-bg text-text-muted'}`}><Activity className="mr-1 inline h-3.5 w-3.5" />Live</button>
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-text-muted"><ListFilter className="h-3.5 w-3.5" />League</span>
          <div className="flex flex-wrap gap-1.5">
            {leagues.map((league) => (
              <button key={league} onClick={() => setLeagueFilter(league)} className={`rounded-md px-2.5 py-1 text-[11px] ${leagueFilter === league ? 'bg-accent-solid text-accent-text-contrast' : 'bg-app-bg text-text-muted'}`}>
                {league === 'all' ? 'All' : league}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={config.splitLayout ? 'grid gap-4 lg:grid-cols-[1.1fr_0.9fr]' : 'space-y-4'}>
        <div className="space-y-2">
          {filtered.map((fixture) => (
            <MatchRow
              key={fixture.fixture.id}
              fixture={fixture}
              compact={config.compactRows}
              oddsLayout={config.oddsLayout}
              isSelected={(value) =>
                bets.some(
                  (b) =>
                    b.fixtureId === fixture.fixture.id &&
                    String(b.betId) === '1' &&
                    b.value === value,
                )
              }
              onSelect={(value) => {
                const odd =
                  value === 'Home'
                    ? Number(fixture.odds.home)
                    : value === 'Draw'
                      ? Number(fixture.odds.draw)
                      : Number(fixture.odds.away);
                if (!Number.isFinite(odd) || odd <= 1) return;

                addToBetSlip({
                  id: selectionIdFor(fixture, value),
                  fixtureId: fixture.fixture.id,
                  betId: 1,
                  value,
                  odd,
                  bookmakerId: 8,
                  fixtureName: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
                  marketName: 'Match Winner',
                  selectionName:
                    value === 'Home' ? fixture.teams.home.name : value === 'Draw' ? 'Draw' : fixture.teams.away.name,
                  odds: odd,
                });
              }}
            />
          ))}
        </div>

        {config.splitLayout ? (
          <aside className="space-y-3">
            {config.showTopLeagues ? (
              <div className="rounded-xl border border-border-subtle bg-element-bg p-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Top Leagues</h2>
                <div className="mt-2 space-y-2">
                  {leagueBuckets.slice(0, 6).map((bucket, idx) => (
                    <div key={bucket.leagueName} className="rounded-lg bg-app-bg px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>#{idx + 1} {bucket.leagueName}</span>
                        <span className="text-xs text-text-muted">{bucket.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-border-subtle bg-element-bg p-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Match Insight</h2>
              {predictionQuery.data?.advice ? (
                <>
                  <p className="mt-2 text-sm text-text-contrast">{predictionQuery.data.advice}</p>
                  <div className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
                    <span className="rounded bg-app-bg px-2 py-1 text-center">Home {predictionQuery.data.percent?.home ?? '-'}</span>
                    <span className="rounded bg-app-bg px-2 py-1 text-center">Draw {predictionQuery.data.percent?.draw ?? '-'}</span>
                    <span className="rounded bg-app-bg px-2 py-1 text-center">Away {predictionQuery.data.percent?.away ?? '-'}</span>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-text-muted">No prediction insight available yet.</p>
              )}
            </div>

            {config.showTrending ? (
              <div className="rounded-xl border border-border-subtle bg-element-bg p-3">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted"><Flame className="h-3.5 w-3.5" />Trending Bets</h2>
                <div className="mt-2 space-y-2">
                  {filtered.slice(0, 5).map((fixture) => (
                    <Link key={`trend-${fixture.fixture.id}`} to={`/play/fixture/${fixture.fixture.id}`} className="block rounded-lg bg-app-bg px-3 py-2 text-sm hover:bg-element-hover-bg">
                      <p className="truncate">{fixture.teams.home.name} vs {fixture.teams.away.name}</p>
                      <p className="text-xs text-text-muted">Kickoff {formatFixtureTime(fixture.fixture.date)}</p>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </section>
  );
}

export type { IterationConfig };
