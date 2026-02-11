import { useNavigate } from 'react-router-dom';
import type { Fixture } from '../hooks/useFootball';
import { formatFixtureTime } from '../lib/date';
import { useBetSlip } from '../context/BetSlipContext';

type MarketView = '1x2' | 'double_chance' | 'over_under' | `extra_${number}`;

type DoubleChanceOdds = {
  homeDraw: string;
  homeAway: string;
  drawAway: string;
};

type TotalsOdds = {
  over25: string;
  under25: string;
};

type DisplayMarketRow = {
  label: string;
  selection: string;
  selectionName: string;
  odd: string | number | undefined;
  handicap?: string | null;
};

type DisplayMarket = {
  betId: number;
  marketName: string;
  rows: DisplayMarketRow[];
};

interface FixtureRowProps {
  fixture: Fixture;
  marketView?: MarketView;
  selectedMarketLabel?: string;
  selectedMarketHeaders?: string[];
}

const isExtraMarketView = (marketView: MarketView): marketView is `extra_${number}` =>
  marketView.startsWith('extra_');

const formatOutcomeLabel = (value: string, handicap?: string | null) =>
  handicap ? `${value} ${handicap}` : value;

export function FixtureRow({
  fixture,
  marketView = '1x2',
  selectedMarketLabel,
  selectedMarketHeaders,
}: FixtureRowProps) {
  const navigate = useNavigate();
  const { addToBetSlip, bets } = useBetSlip();

  // Use simplified odds from hook for the 3 quick markets.
  const homeOdd = fixture.odds?.home;
  const drawOdd = fixture.odds?.draw;
  const awayOdd = fixture.odds?.away;
  const doubleChanceOdds = fixture.odds?.doubleChance as DoubleChanceOdds | undefined;
  const totalsOdds = fixture.odds?.totals as TotalsOdds | undefined;

  const handleRowClick = () => {
    navigate(`/play/fixture/${fixture.fixture.id}`);
  };

  const handleOddClick = (
    e: React.MouseEvent,
    betId: number,
    selection: string,
    selectionName: string,
    rawOdd: string | number | undefined,
    marketName: string,
    handicap?: string | null,
  ) => {
    e.stopPropagation();
    const parsedOdd = Number(rawOdd);
    if (!Number.isFinite(parsedOdd) || parsedOdd <= 1) return;

    const normalizedSelection = selection.replace(/\s+/g, '_');
    const normalizedHandicap = (handicap ?? 'nohcp').toString().replace(/\s+/g, '_');
    const selectionId = `${fixture.fixture.id}-mw-${betId}-${normalizedSelection}-${normalizedHandicap}`;

    addToBetSlip({
      id: selectionId,
      fixtureId: fixture.fixture.id,
      betId,
      value: selection,
      odd: parsedOdd,
      handicap: handicap ?? undefined,
      bookmakerId: 8,
      fixtureName: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
      marketName,
      selectionName,
      odds: parsedOdd,
      leagueName: fixture.league.name,
      leagueCountry: fixture.league.country,
      fixtureDate: fixture.fixture.date,
    });
  };

  const isSelectionActive = (
    betId: number,
    selection: string,
    handicap?: string | null,
  ) =>
    bets.some(
      (b) =>
        b.fixtureId === fixture.fixture.id &&
        String(b.betId) === String(betId) &&
        b.value === selection &&
        String(b.handicap ?? '') === String(handicap ?? ''),
    );

  const time = formatFixtureTime(fixture.fixture.date);
  const isLive = ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(fixture.fixture.status.short);

  const extraMarketId = isExtraMarketView(marketView)
    ? Number(marketView.slice('extra_'.length))
    : null;
  const selectedExtraMarket =
    extraMarketId !== null
      ? fixture.markets.find((market) => market.id === extraMarketId)
      : undefined;
  const extraRows = (selectedExtraMarket?.values ?? [])
    .filter((value) => {
      const odd = Number(value.odd);
      return Number.isFinite(odd) && odd > 1;
    })
    .slice(0, 3)
    .map((value) => ({
      label: formatOutcomeLabel(value.value, value.handicap),
      selection: value.value,
      selectionName: formatOutcomeLabel(value.value, value.handicap),
      odd: value.odd,
      handicap: value.handicap,
    }));

  const fallbackExtraRows = (selectedMarketHeaders?.slice(0, 3) ?? ['A', 'B', 'C']).map(
    (header) => ({
      label: header,
      selection: header,
      selectionName: header,
      odd: undefined,
    }),
  );

  const market: DisplayMarket =
    extraMarketId !== null
      ? {
          betId: extraMarketId,
          marketName: selectedExtraMarket?.name ?? selectedMarketLabel ?? 'Market',
          rows: extraRows.length > 0 ? extraRows : fallbackExtraRows,
        }
      : marketView === 'double_chance'
        ? {
            betId: 12,
            marketName: 'Double Chance',
            rows: [
              {
                label: '1/X',
                selection: 'Home/Draw',
                selectionName: 'Home/Draw',
                odd: doubleChanceOdds?.homeDraw,
              },
              {
                label: '1/2',
                selection: 'Home/Away',
                selectionName: 'Home/Away',
                odd: doubleChanceOdds?.homeAway,
              },
              {
                label: 'X/2',
                selection: 'Draw/Away',
                selectionName: 'Draw/Away',
                odd: doubleChanceOdds?.drawAway,
              },
            ],
          }
        : marketView === 'over_under'
          ? {
              betId: 5,
              marketName: 'Over/Under 2.5',
              rows: [
                {
                  label: 'O2.5',
                  selection: 'Over 2.5',
                  selectionName: 'Over 2.5',
                  odd: totalsOdds?.over25,
                },
                {
                  label: 'U2.5',
                  selection: 'Under 2.5',
                  selectionName: 'Under 2.5',
                  odd: totalsOdds?.under25,
                },
              ],
            }
          : {
              betId: 1,
              marketName: 'Match Winner',
              rows: [
                {
                  label: '1',
                  selection: 'Home',
                  selectionName: fixture.teams.home.name,
                  odd: homeOdd,
                },
                {
                  label: 'X',
                  selection: 'Draw',
                  selectionName: 'Draw',
                  odd: drawOdd,
                },
                {
                  label: '2',
                  selection: 'Away',
                  selectionName: fixture.teams.away.name,
                  odd: awayOdd,
                },
              ],
            };

  const marketGridClass = market.rows.length === 2 ? 'w-52 grid-cols-2' : 'w-64 grid-cols-3';
  const mobileMarketLabel =
    extraMarketId !== null
      ? selectedExtraMarket?.name ?? selectedMarketLabel ?? 'Market'
      : marketView === 'double_chance'
        ? 'DOUBLE CHANCE'
        : marketView === 'over_under'
          ? 'OVER/UNDER 2.5'
          : '1X2';

  return (
    <div
      onClick={handleRowClick}
      className="group relative w-full cursor-pointer border-b border-[#333] bg-[#1d1d1d] transition-colors hover:bg-[#252525]"
    >
      {/* Desktop Layout (md+) */}
      <div className="hidden w-full flex-row items-center gap-4 px-4 py-3 md:flex">
        {/* Time / Status */}
        <div className="flex w-16 shrink-0 flex-col items-center justify-center">
          {isLive ? (
            <span className="rounded bg-[#ff3939]/10 px-1 text-[11px] font-medium text-[#ff3939] animate-pulse">
              {fixture.fixture.status.elapsed}'
            </span>
          ) : (
            <span className="text-[12px] font-medium text-[#c8c8c8]">{time}</span>
          )}
        </div>

        {/* Teams */}
        <div className="flex flex-1 flex-col justify-center">
          <div className="mb-1 flex items-center gap-2">
            <img
              src={fixture.teams.home.logo}
              alt={fixture.teams.home.name}
              className="h-4 w-4 object-contain"
            />
            <span className="truncate text-[13px] font-medium text-[#fafafa]">
              {fixture.teams.home.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <img
              src={fixture.teams.away.logo}
              alt={fixture.teams.away.name}
              className="h-4 w-4 object-contain"
            />
            <span className="truncate text-[13px] font-medium text-[#fafafa]">
              {fixture.teams.away.name}
            </span>
          </div>
        </div>

        {/* Live Score (if applicable) */}
        {(isLive || fixture.goals.home !== null) && (
          <div className="flex w-12 flex-col items-center justify-center gap-1 font-bold text-[#ffd60a]">
            <span>{fixture.goals.home ?? 0}</span>
            <span>{fixture.goals.away ?? 0}</span>
          </div>
        )}

        {/* Market Odds */}
        <div className={`grid ${marketGridClass} gap-2`}>
          {market.rows.map((row) => (
            <OddButton
              key={`${row.label}-${row.selection}-${row.handicap ?? 'nohcp'}`}
              label={row.label}
              odd={row.odd}
              showLabel={false}
              isSelected={isSelectionActive(market.betId, row.selection, row.handicap)}
              onClick={(e) =>
                handleOddClick(
                  e,
                  market.betId,
                  row.selection,
                  row.selectionName,
                  row.odd,
                  market.marketName,
                  row.handicap,
                )
              }
            />
          ))}
        </div>

        {/* Plus Button for More Markets */}
        <div onClick={handleRowClick} className="group/plus flex w-8 cursor-pointer items-center justify-center">
          <div className="flex h-6 w-6 items-center justify-center rounded border border-[#333] bg-[#1d1d1d] transition-colors group-hover/plus:bg-[#333]">
            <svg className="h-4 w-4 text-[#c8c8c8] group-hover/plus:text-[#ffd60a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
            </svg>
          </div>
        </div>
      </div>

      {/* Mobile Layout (< md) */}
      <div className="flex w-full flex-col gap-3 px-4 py-3 md:hidden">
        <div className="flex items-center justify-between text-[11px] text-[#c8c8c8]">
          <span className="flex items-center gap-2 font-semibold text-text-muted">
            <img
              src={fixture.league.flag ?? fixture.league.logo}
              alt={fixture.league.name}
              className="h-4 w-4 object-contain"
            />
            {fixture.league.name}
          </span>
          <span className="text-xs">{time}</span>
        </div>

        <div className="flex items-center justify-center gap-3 text-[14px] font-semibold text-text-contrast">
          <span className="text-sm">{fixture.teams.home.name}</span>
          <img src={fixture.teams.home.logo} alt={fixture.teams.home.name} className="h-6 w-6 object-contain" />
          <span className="text-[11px] font-medium text-[#8bd2ff]">VS</span>
          <img src={fixture.teams.away.logo} alt={fixture.teams.away.name} className="h-6 w-6 object-contain" />
          <span className="text-sm">{fixture.teams.away.name}</span>
        </div>

        <div className="truncate text-[10px] font-semibold uppercase tracking-[0.4em] text-[#8bd2ff]">
          {mobileMarketLabel}
        </div>

        <div className={`grid ${market.rows.length === 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-2`}>
          {market.rows.map((row) => (
            <OddButton
              key={`${row.label}-${row.selection}-${row.handicap ?? 'nohcp'}-mobile`}
              label={row.label}
              odd={row.odd}
              isSelected={isSelectionActive(market.betId, row.selection, row.handicap)}
              onClick={(e) =>
                handleOddClick(
                  e,
                  market.betId,
                  row.selection,
                  row.selectionName,
                  row.odd,
                  market.marketName,
                  row.handicap,
                )
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Sub-component for Odds Button
function OddButton({
  label,
  subLabel,
  odd,
  showLabel = true,
  isSelected,
  onClick,
}: {
  label: string;
  subLabel?: string;
  odd: string | number | undefined;
  showLabel?: boolean;
  isSelected?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const parsedOdd = typeof odd === 'number' ? odd : Number(odd);
  const isSelectable = Number.isFinite(parsedOdd) && parsedOdd > 1;
  const displayOdd = isSelectable ? parsedOdd.toFixed(2) : '-';

  return (
    <button
      onClick={onClick}
      disabled={!isSelectable}
      className={`group/btn flex h-full w-full flex-col items-center justify-center rounded border px-1 py-2 transition-colors ${
        isSelected
          ? 'border-[#ffd60a] bg-[#ffd60a] text-[#1d1d1d]'
          : isSelectable
            ? 'border-[#111] bg-[#3a3a3a] hover:bg-[#4a4a4a] active:bg-[#2b2b2b]'
            : 'cursor-not-allowed border-[#222] bg-[#2b2b2b] text-[#8a8a8a]'
      }`}
    >
      {showLabel && (
        <span
          className={`mb-0.5 w-full truncate px-1 text-center text-[10px] ${
            isSelected ? 'text-[#1d1d1d]/80' : 'text-[#e6e6e6]'
          }`}
        >
          {subLabel || label}
        </span>
      )}
      <span className={`text-[13px] font-bold ${isSelected ? 'text-[#1d1d1d]' : 'text-[#ffffff]'}`}>
        {displayOdd}
      </span>
    </button>
  );
}
