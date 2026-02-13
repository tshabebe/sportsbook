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
  const extraMarketValues = (selectedExtraMarket?.values ?? [])
    .filter((value) => {
      const odd = Number(value.odd);
      return Number.isFinite(odd) && odd > 1;
    });
  const extraValueByLabel = new Map(
    extraMarketValues.map((value) => [formatOutcomeLabel(value.value, value.handicap), value]),
  );
  const extraColumnLabels =
    selectedMarketHeaders && selectedMarketHeaders.length > 0
      ? selectedMarketHeaders.slice(0, 3)
      : extraMarketValues.slice(0, 3).map((value) => formatOutcomeLabel(value.value, value.handicap));
  const extraRows =
    extraColumnLabels.length > 0
      ? extraColumnLabels.map((label) => {
        const value = extraValueByLabel.get(label);
        if (!value) {
          return {
            label,
            selection: label,
            selectionName: label,
            odd: undefined,
          };
        }

        return {
          label,
          selection: value.value,
          selectionName: formatOutcomeLabel(value.value, value.handicap),
          odd: value.odd,
          handicap: value.handicap,
        };
      })
      : ['A', 'B', 'C'].map((label) => ({
        label,
        selection: label,
        selectionName: label,
        odd: undefined,
      }));

  const market: DisplayMarket =
    extraMarketId !== null
      ? {
        betId: extraMarketId,
        marketName: selectedExtraMarket?.name ?? selectedMarketLabel ?? 'Market',
        rows: extraRows,
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

  const marketWidthClass = market.rows.length === 2 ? 'w-36 md:w-52' : 'w-48 md:w-64';
  const marketItemClass =
    market.rows.length === 2
      ? 'w-[calc((100%-0.5rem)/2)]'
      : 'w-[calc((100%-1rem)/3)]';

  return (
    <div
      onClick={handleRowClick}
      className="group relative w-full cursor-pointer border-b border-border-subtle bg-element-bg transition-colors hover:bg-element-hover-bg"
    >
      <div className="hidden w-full flex-row items-center gap-4 px-4 py-3 md:flex">
        <div className="flex w-16 shrink-0 flex-col items-center justify-center">
          {isLive ? (
            <span className="animate-pulse rounded bg-status-negative-soft px-1 text-[11px] font-medium text-status-negative">
              {fixture.fixture.status.elapsed}'
            </span>
          ) : (
            <span className="text-[12px] font-medium text-text-muted">{time}</span>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <div className="flex items-center gap-2">
            <img
              src={fixture.teams.home.logo}
              alt={fixture.teams.home.name}
              className="h-4 w-4 object-contain"
            />
            <span className="truncate text-[13px] font-medium text-text-contrast">
              {fixture.teams.home.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <img
              src={fixture.teams.away.logo}
              alt={fixture.teams.away.name}
              className="h-4 w-4 object-contain"
            />
            <span className="truncate text-[13px] font-medium text-text-contrast">
              {fixture.teams.away.name}
            </span>
          </div>
        </div>

        {(isLive || fixture.goals.home !== null) && (
          <div className="flex w-12 flex-col items-center justify-center gap-1 font-bold text-accent-solid">
            <span>{fixture.goals.home ?? 0}</span>
            <span>{fixture.goals.away ?? 0}</span>
          </div>
        )}

        <div className={`${marketWidthClass} flex flex-wrap gap-2`}>
          {market.rows.map((row) => (
            <div key={`${row.label}-${row.selection}-${row.handicap ?? 'nohcp'}`} className={marketItemClass}>
              <OddButton
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
            </div>
          ))}
        </div>

        <div onClick={handleRowClick} className="group/plus flex w-8 cursor-pointer items-center justify-center">
          <div className="flex h-6 w-6 items-center justify-center rounded border border-border-subtle bg-element-bg transition-colors group-hover/plus:bg-element-hover-bg">
            <svg className="h-4 w-4 text-text-muted group-hover/plus:text-accent-solid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex w-full items-center gap-3 px-4 py-3 md:hidden">
        <div className="flex min-w-0 flex-1 flex-col gap-1 justify-center">
          <div className="flex items-center gap-2">
            <img
              src={fixture.teams.home.logo}
              alt={fixture.teams.home.name}
              className="h-4 w-4 object-contain"
            />
            <span className="truncate text-[13px] font-medium text-text-contrast">
              {fixture.teams.home.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <img
              src={fixture.teams.away.logo}
              alt={fixture.teams.away.name}
              className="h-4 w-4 object-contain"
            />
            <span className="truncate text-[13px] font-medium text-text-contrast">
              {fixture.teams.away.name}
            </span>
          </div>
          <span className="text-[11px] font-medium text-text-muted">{time}</span>
        </div>

        <div className={`${marketWidthClass} flex flex-wrap gap-2`}>
          {market.rows.map((row) => (
            <div
              key={`${row.label}-${row.selection}-${row.handicap ?? 'nohcp'}-mobile`}
              className={marketItemClass}
            >
              <OddButton
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
      className={`group/btn flex h-full w-full flex-col items-center justify-center gap-0.5 rounded border px-1 py-2 transition-colors ${isSelected
          ? 'border-accent-solid bg-accent-solid text-accent-text-contrast'
          : isSelectable
            ? 'border-border-subtle bg-element-hover-bg text-text-contrast hover:bg-element-bg active:bg-element-hover-bg'
            : 'cursor-not-allowed border-border-subtle bg-app-bg text-text-muted'
        }`}
    >
      {showLabel && (
        <span
          className={`w-full truncate px-1 text-center text-[10px] ${isSelected ? 'text-accent-text-contrast/80' : 'text-text-muted'
            }`}
        >
          {subLabel || label}
        </span>
      )}
      <span className={`text-[13px] font-bold ${isSelected ? 'text-accent-text-contrast' : 'text-text-contrast'}`}>
        {displayOdd}
      </span>
    </button>
  );
}
