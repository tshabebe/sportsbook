import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../lib/api';
import { useBetSlip } from '../context/BetSlipContext';
import { formatFixtureTime } from '../lib/date';

type MarketCategoryKey =
  | 'all'
  | 'main'
  | 'handicap'
  | 'totals'
  | 'playerGoals'
  | 'corners'
  | 'booking'
  | 'combo'
  | 'half'
  | 'other';

interface FixtureDetails {
  fixture: { id: number; date: string };
  league: { name: string; logo: string };
  teams: {
    home: { name: string; logo: string };
    away: { name: string; logo: string };
  };
}

interface OddsData {
  fixture: { id: number; date: string };
  league: { name: string };
  bookmakers: Array<{
    id: number;
    bets: Array<{
      id: number;
      name: string;
      values: Array<{ value: string; odd: string; handicap?: string }>;
    }>;
  }>;
}

const categoryOrder: Array<{ key: MarketCategoryKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'main', label: 'Main' },
  { key: 'handicap', label: 'Handicap' },
  { key: 'totals', label: 'Totals' },
  { key: 'playerGoals', label: 'Player Goals' },
  { key: 'corners', label: 'Corners' },
  { key: 'booking', label: 'Booking' },
  { key: 'combo', label: 'Combo' },
  { key: 'half', label: 'Half' },
  { key: 'other', label: 'Other' },
];

const classifyMarket = (name: string): MarketCategoryKey => {
  const n = name.toLowerCase();

  if (n.includes('match winner') || n.includes('double chance') || n.includes('draw no bet') || n.includes('1x2')) {
    return 'main';
  }
  if (n.includes('handicap') || n.includes('asian')) return 'handicap';
  if (
    n.includes('over') ||
    n.includes('under') ||
    n.includes('total') ||
    n.includes('both teams to score') ||
    n.includes('goals')
  ) {
    return 'totals';
  }
  if (n.includes('player') || n.includes('scorer') || n.includes('to score')) return 'playerGoals';
  if (n.includes('corner')) return 'corners';
  if (n.includes('card') || n.includes('booking') || n.includes('yellow') || n.includes('red')) return 'booking';
  if (n.includes('combo') || n.includes('and')) return 'combo';
  if (n.includes('half') || n.includes('1st') || n.includes('2nd') || n.includes('ht')) return 'half';
  return 'other';
};

function MarketAccordion({
  title,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-element-bg">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between bg-element-hover-bg px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-text-contrast">{title}</span>
        {isOpen ? <ChevronUp className="h-5 w-5 text-text-muted" /> : <ChevronDown className="h-5 w-5 text-text-muted" />}
      </button>
      <div className={`${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden transition-all duration-300`}>
        <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-3">
          {children}
        </div>
      </div>
    </div>
  );
}

function OutcomeButton({
  label,
  odd,
  handicap,
  isSelected,
  onClick,
}: {
  label: string;
  odd: string;
  handicap?: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2 py-2 text-center transition ${
        isSelected
          ? 'border-accent-solid bg-accent-solid text-accent-text-contrast'
          : 'border-border-subtle bg-app-bg text-text-contrast hover:border-accent-solid/50'
      }`}
    >
      <div className="text-[11px] leading-tight opacity-90">{label}{handicap ? ` ${handicap}` : ''}</div>
      <div className="mt-1 text-sm font-semibold">{odd}</div>
    </button>
  );
}

export function FixtureMarketsPage() {
  const { fixtureId } = useParams<{ fixtureId: string }>();
  const navigate = useNavigate();
  const { addToBetSlip, bets } = useBetSlip();
  const [activeCategory, setActiveCategory] = useState<MarketCategoryKey>('all');
  const [openMarkets, setOpenMarkets] = useState<Record<number, boolean>>({});

  const { data: fixtureDetails, isLoading: isLoadingFixture } = useQuery({
    queryKey: ['fixture-details', fixtureId],
    queryFn: async () => {
      const { data } = await api.get('/football/fixtures', { params: { id: fixtureId } });
      return data.response?.[0] as FixtureDetails | undefined;
    },
    enabled: !!fixtureId,
  });

  const { data: oddsData, isLoading: isLoadingOdds } = useQuery({
    queryKey: ['fixture-odds', fixtureId],
    queryFn: async () => {
      const { data } = await api.get('/football/odds', {
        params: { fixture: fixtureId, bookmaker: 8 },
      });
      return data.response?.[0] as OddsData | undefined;
    },
    enabled: !!fixtureId,
  });

  const isLoading = isLoadingFixture || isLoadingOdds;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-lg bg-element-hover-bg" />
        <div className="h-24 animate-pulse rounded-lg bg-element-hover-bg" />
        <div className="h-10 animate-pulse rounded-lg bg-element-hover-bg" />
        <div className="h-72 animate-pulse rounded-lg bg-element-hover-bg" />
      </div>
    );
  }

  if (!fixtureDetails) return <div className="py-16 text-center text-text-muted">Fixture not found.</div>;

  const fixture = fixtureDetails.fixture;
  const league = fixtureDetails.league;
  const teams = fixtureDetails.teams;
  const markets = oddsData?.bookmakers?.[0]?.bets || [];
  const bookmakerId = oddsData?.bookmakers?.[0]?.id;
  const fixtureName = `${teams.home.name} vs ${teams.away.name}`;

  const categorized = markets.reduce<Record<MarketCategoryKey, OddsData['bookmakers'][number]['bets']>>(
    (acc, market) => {
      const k = classifyMarket(market.name);
      acc[k].push(market);
      return acc;
    },
    {
      all: [],
      main: [],
      handicap: [],
      totals: [],
      playerGoals: [],
      corners: [],
      booking: [],
      combo: [],
      half: [],
      other: [],
    },
  );

  categorized.all = markets;

  const visibleMarkets = categorized[activeCategory];

  const toggleMarket = (marketId: number) => {
    setOpenMarkets((prev) => ({ ...prev, [marketId]: !prev[marketId] }));
  };

  const isSelected = (selectionId: string) => bets.some((b) => b.id === selectionId);

  return (
    <div className="mx-auto w-full max-w-[980px] space-y-4 pb-20">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border-subtle bg-app-bg/95 px-1 py-2 backdrop-blur">
        <button onClick={() => navigate(-1)} className="rounded-md p-1.5 hover:bg-element-hover-bg">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text-contrast">{teams.home.name} vs {teams.away.name}</div>
          <div className="text-[11px] text-text-muted">{league.name} • {formatFixtureTime(fixture.date)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-border-subtle bg-element-bg p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <img src={teams.home.logo} alt={teams.home.name} className="h-9 w-9 object-contain" />
            <div className="truncate text-sm font-semibold">{teams.home.name}</div>
          </div>
          <div className="text-sm font-bold text-text-muted">VS</div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <div className="truncate text-right text-sm font-semibold">{teams.away.name}</div>
            <img src={teams.away.logo} alt={teams.away.name} className="h-9 w-9 object-contain" />
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {categoryOrder.map((cat) => {
          const count = cat.key === 'all' ? markets.length : categorized[cat.key].length;
          if (count === 0 && cat.key !== 'all') return null;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                activeCategory === cat.key ? 'bg-accent-solid text-accent-text-contrast' : 'bg-element-bg text-text-muted'
              }`}
            >
              {cat.label} {count > 0 ? `(${count})` : ''}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {visibleMarkets.length === 0 ? (
          <div className="rounded-lg border border-border-subtle bg-element-bg p-6 text-center text-sm text-text-muted">
            No markets available in this category.
          </div>
        ) : (
          visibleMarkets.map((market) => (
            <MarketAccordion
              key={market.id}
              title={market.name}
              isOpen={openMarkets[market.id] ?? (activeCategory === 'main' || activeCategory === 'all')}
              onToggle={() => toggleMarket(market.id)}
            >
              {market.values.map((outcome, idx) => {
                const selectionId = `${fixture.id}-${market.id}-${outcome.value}-${outcome.handicap ?? 'nohcp'}-${idx}`;
                return (
                  <OutcomeButton
                    key={`${outcome.value}-${outcome.handicap ?? 'nohcp'}-${idx}`}
                    label={outcome.value}
                    odd={outcome.odd}
                    handicap={outcome.handicap}
                    isSelected={isSelected(selectionId)}
                    onClick={() => {
                      addToBetSlip({
                        id: selectionId,
                        fixtureId: fixture.id,
                        betId: market.id,
                        value: outcome.value,
                        odd: Number(outcome.odd),
                        handicap: outcome.handicap,
                        bookmakerId: bookmakerId ?? undefined,
                        fixtureName,
                        marketName: market.name,
                        selectionName: `${outcome.value}${outcome.handicap ? ` ${outcome.handicap}` : ''}`,
                        odds: Number(outcome.odd),
                      });
                    }}
                  />
                );
              })}
            </MarketAccordion>
          ))
        )}
      </div>
    </div>
  );
}
