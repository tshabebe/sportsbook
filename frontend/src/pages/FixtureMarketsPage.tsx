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
}: {
  title: string;
  testId: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      className="w-full overflow-hidden rounded-lg border border-border-subtle bg-element-bg md:w-[calc((100%-0.75rem)/2)]"
    >
      <button
        data-testid="market-accordion-toggle"
        aria-expanded={isOpen}
        onClick={onToggle}
        className="flex w-full items-center justify-between bg-element-hover-bg px-4 py-3 text-left transition-colors hover:bg-app-bg"
      >
        <span className="text-sm font-semibold text-text-contrast">{title}</span>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-text-muted" />
        ) : (
          <ChevronDown className="h-5 w-5 text-text-muted" />
        )}
      </button>
      <div
        data-testid="market-accordion-content"
        className={`${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden transition-all duration-300`}
      >
        <div className="flex flex-wrap gap-2 p-3">
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
      <div className="text-sm font-semibold">{odd}</div>
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
      <div className="flex flex-col gap-4 p-4">
        <div className="h-40 animate-pulse rounded-xl bg-element-bg" />
        <div className="h-12 animate-pulse rounded-lg bg-element-bg" />
        <div className="flex flex-col gap-3">
          <div className="h-64 animate-pulse rounded-lg bg-element-bg" />
          <div className="h-64 animate-pulse rounded-lg bg-element-bg" />
        </div>
      </div>
    );
  }

  if (!fixtureDetails) return <div className="py-20 text-center text-text-muted">Fixture not found.</div>;

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
    <div className="flex w-full justify-center">
      <div className="w-full max-w-[980px] pb-24">
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border-subtle bg-app-bg/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-app-bg/80">
        <button
          data-testid="fixture-back-button"
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-element-hover-bg text-text-contrast hover:bg-element-bg"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-sm font-bold text-text-contrast">{teams.home.name} vs {teams.away.name}</h1>
          <p className="truncate text-[11px] text-text-muted">{league.name}</p>
        </div>
        <div className="w-8" />
      </div>

      <div className="px-4 py-4">
        <div className="rounded-2xl border border-border-subtle bg-element-bg p-6 shadow-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="rounded bg-app-bg px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
              {formatFixtureTime(fixture.date)}
            </div>

            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex flex-1 flex-col items-center gap-2 text-center">
                <img src={teams.home.logo} alt={teams.home.name} className="h-16 w-16 object-contain drop-shadow-md" />
                <span className="text-sm font-bold leading-tight text-text-contrast">{teams.home.name}</span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-2xl font-black tracking-widest text-accent-solid">VS</span>
              </div>

              <div className="flex flex-1 flex-col items-center gap-2 text-center">
                <img src={teams.away.logo} alt={teams.away.name} className="h-16 w-16 object-contain drop-shadow-md" />
                <span className="text-sm font-bold leading-tight text-text-contrast">{teams.away.name}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-[57px] z-10 bg-app-bg px-4 pb-2 pt-0">
        <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {categoryOrder.map((cat) => {
            const count = cat.key === 'all' ? markets.length : categorized[cat.key].length;
            if (count === 0 && cat.key !== 'all') return null;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all ${activeCategory === cat.key
                  ? 'bg-accent-solid text-accent-text-contrast shadow-sm'
                  : 'bg-element-bg text-text-muted hover:bg-element-hover-bg hover:text-text-contrast'
                  }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <div data-testid="fixture-markets-grid" className="flex flex-wrap gap-3 px-4 pb-8">
        {visibleMarkets.length === 0 ? (
          <div className="w-full rounded-xl border border-border-subtle bg-element-bg p-8 text-center text-sm text-text-muted">
            No markets available in this category.
          </div>
        ) : (
          visibleMarkets.map((market, marketIdx) => {
            const marketKey = `${market.id}-${market.name}-${marketIdx}`;
            const marketTestId = `market-accordion-${market.id}-${marketIdx}`;

            const outcomeCount = market.values.length;
            const marketItemClass =
              outcomeCount === 3
                ? 'w-[calc((100%-1rem)/3)]'
                : outcomeCount === 2
                  ? 'w-[calc((100%-0.5rem)/2)]'
                  : 'w-[calc((100%-0.5rem)/2)] md:w-[calc((100%-1rem)/3)]';

            return (
              <MarketAccordion
                key={marketKey}
                testId={marketTestId}
                title={market.name}
                isOpen={openMarkets[marketKey] ?? false}
                onToggle={() => toggleMarket(marketKey)}
              >
                {market.values.map((outcome, idx) => {
                  const selectionId = `${fixture.id}-${marketKey}-${outcome.value}-${outcome.handicap ?? 'nohcp'}-${idx}`;
                  return (
                    <div
                      key={`${outcome.value}-${outcome.handicap ?? 'nohcp'}-${idx}`}
                      className={marketItemClass}
                    >
                      <OutcomeButton
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
                    </div>
                  );
                })}
              </MarketAccordion>
            );
          })
        )}
      </div>
      </div>
    </div>
  );
}
