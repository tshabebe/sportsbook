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
  testId,
  isOpen,
  onToggle,
  children,
  colsClass = 'grid-cols-2 md:grid-cols-3',
}: {
  title: string;
  testId: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  colsClass?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="overflow-hidden rounded-lg border border-[#333] bg-[#1d1d1d]"
    >
      <button
        data-testid="market-accordion-toggle"
        aria-expanded={isOpen}
        onClick={onToggle}
        className="flex w-full items-center justify-between bg-[#2a2a2a] px-4 py-3 text-left transition-colors hover:bg-[#333]"
      >
        <span className="text-sm font-semibold text-[#fafafa]">{title}</span>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-[#8a8a8a]" />
        ) : (
          <ChevronDown className="h-5 w-5 text-[#8a8a8a]" />
        )}
      </button>
      <div
        data-testid="market-accordion-content"
        className={`${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden transition-all duration-300`}
      >
        <div className={`grid gap-2 p-3 ${colsClass}`}>
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
      className={`rounded-md border px-2 py-2 text-center transition ${isSelected
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
  const [activeCategory, setActiveCategory] = useState<MarketCategoryKey>('main');
  const [openMarkets, setOpenMarkets] = useState<Record<string, boolean>>({});

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
      <div className="space-y-4 p-4">
        <div className="h-40 animate-pulse rounded-xl bg-[#1d1d1d]" />
        <div className="h-12 animate-pulse rounded-lg bg-[#1d1d1d]" />
        <div className="space-y-3">
          <div className="h-64 animate-pulse rounded-lg bg-[#1d1d1d]" />
          <div className="h-64 animate-pulse rounded-lg bg-[#1d1d1d]" />
        </div>
      </div>
    );
  }

  if (!fixtureDetails) return <div className="py-20 text-center text-[#8a8a8a]">Fixture not found.</div>;

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

  const visibleMarkets = categorized[activeCategory] || [];

  const toggleMarket = (marketKey: string) => {
    setOpenMarkets((prev) => ({ ...prev, [marketKey]: !prev[marketKey] }));
  };

  const isSelected = (selectionId: string) => bets.some((b) => b.id === selectionId);

  return (
    <div className="mx-auto w-full max-w-[980px] pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#333] bg-[#0d0d0d]/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-[#0d0d0d]/80">
        <button
          data-testid="fixture-back-button"
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2a2a2a] text-[#ffffff] hover:bg-[#333]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-sm font-bold text-[#ffffff]">{teams.home.name} vs {teams.away.name}</h1>
          <p className="truncate text-[11px] text-[#8a8a8a]">{league.name}</p>
        </div>
        <div className="w-8" /> {/* Spacer for centering */}
      </div>

      {/* Scoreboard / Info Card */}
      <div className="px-4 py-4">
        <div className="rounded-2xl bg-gradient-to-br from-[#1d1d1d] to-[#141414] p-6 shadow-lg border border-[#333]">
          <div className="flex flex-col items-center gap-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#8a8a8a] bg-[#2a2a2a] px-2 py-0.5 rounded">
              {formatFixtureTime(fixture.date)}
            </div>

            <div className="flex w-full items-center justify-between">
              <div className="flex flex-1 flex-col items-center gap-2 text-center">
                <img src={teams.home.logo} alt={teams.home.name} className="h-16 w-16 object-contain drop-shadow-md" />
                <span className="text-sm font-bold text-[#ffffff] leading-tight">{teams.home.name}</span>
              </div>

              <div className="mx-2 flex flex-col items-center">
                <span className="text-2xl font-black text-[#ffd60a] tracking-widest">VS</span>
              </div>

              <div className="flex flex-1 flex-col items-center gap-2 text-center">
                <img src={teams.away.logo} alt={teams.away.name} className="h-16 w-16 object-contain drop-shadow-md" />
                <span className="text-sm font-bold text-[#ffffff] leading-tight">{teams.away.name}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="sticky top-[57px] z-10 bg-[#0d0d0d] px-4 pb-2 pt-0">
        <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {categoryOrder.map((cat) => {
            const count = cat.key === 'all' ? markets.length : categorized[cat.key].length;
            if (count === 0 && cat.key !== 'all') return null;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${activeCategory === cat.key
                  ? 'bg-[#ffd60a] text-[#000000] shadow-[0_0_10px_rgba(255,214,10,0.3)]'
                  : 'bg-[#1d1d1d] text-[#8a8a8a] hover:bg-[#2a2a2a] hover:text-[#ffffff]'
                  }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Markets List */}
      <div data-testid="fixture-markets-grid" className="grid gap-3 px-4 pb-8 md:grid-cols-2">
        {visibleMarkets.length === 0 ? (
          <div className="rounded-xl border border-[#333] bg-[#1d1d1d] p-8 text-center text-sm text-[#8a8a8a]">
            No markets available in this category.
          </div>
        ) : (
          visibleMarkets.map((market, marketIdx) => {
            const marketKey = `${market.id}-${market.name}-${marketIdx}`;
            const marketTestId = `market-accordion-${market.id}-${marketIdx}`;

            // Determine adaptive grid columns
            // If exactly 3 outcomes (like 1X2), use grid-cols-3
            // If 2 outcomes (Over/Under), use grid-cols-2
            // Else default to grid-cols-2 or grid-cols-3 based on count
            const outcomeCount = market.values.length;
            const gridColsClass = outcomeCount === 3
              ? 'grid-cols-3'
              : outcomeCount === 2
                ? 'grid-cols-2'
                : 'grid-cols-2 md:grid-cols-3';

            return (
              <MarketAccordion
                key={marketKey}
                testId={marketTestId}
                title={market.name}
                isOpen={openMarkets[marketKey] ?? false}
                onToggle={() => toggleMarket(marketKey)}
                colsClass={gridColsClass}
              >
                {market.values.map((outcome, idx) => {
                  const selectionId = `${fixture.id}-${marketKey}-${outcome.value}-${outcome.handicap ?? 'nohcp'}-${idx}`;
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
                          leagueName: league.name,
                          fixtureDate: fixture.date,
                        });
                      }}
                    />
                  );
                })}
              </MarketAccordion>
            );
          })
        )}
      </div>
    </div>
  );
}
