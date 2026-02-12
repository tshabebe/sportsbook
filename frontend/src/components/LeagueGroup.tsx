
import type { Fixture } from '../hooks/useFootball';
import { FixtureRow } from './FixtureRow';

interface LeagueGroupProps {
  leagueName: string;
  leagueLogo?: string;
  countryFlag?: string;
  fixtures: Fixture[];
  defaultExpanded?: boolean;
  marketView?: MarketView;
  selectedMarketLabel?: string;
  selectedMarketHeaders?: string[];
}

type MarketView = '1x2' | 'double_chance' | 'over_under' | `extra_${number}`;

const isExtraMarketView = (marketView: MarketView): marketView is `extra_${number}` =>
  marketView.startsWith('extra_');

export function LeagueGroup({
  leagueName,
  leagueLogo,
  countryFlag,
  fixtures,
  marketView = '1x2',
  selectedMarketLabel,
  selectedMarketHeaders,
}: LeagueGroupProps) {
  // Fallback logo if country flag is missing.
  const logoUrl =
    countryFlag || leagueLogo || fixtures[0]?.league.flag || fixtures[0]?.league.logo;
  const countryName = fixtures[0]?.league.country;
  const marketHeaders = isExtraMarketView(marketView)
    ? selectedMarketHeaders?.slice(0, 3) ?? ['A', 'B', 'C']
    : marketView === 'double_chance'
      ? ['1/X', '1/2', 'X/2']
      : marketView === 'over_under'
        ? ['O2.5', 'U2.5']
        : ['1', 'X', '2'];

  // Match the responsive widths from FixtureRow
  const marketHeaderClass =
    marketHeaders.length === 2
      ? 'w-36 md:w-52 grid grid-cols-2'
      : 'w-48 md:w-64 grid grid-cols-3';

  const headerTitle = isExtraMarketView(marketView) ? selectedMarketLabel : null;

  return (
    <div className="mb-2 flex w-full flex-col overflow-hidden rounded-lg border border-[#333] bg-[#1d1d1d]">
      {/* League Header */}
      <div
        className="flex items-center gap-4 border-b border-[#333] bg-[#2a2a2a] px-4 py-2"
      >
        {/* Time Spacer */}
        <div className="hidden md:block w-16 shrink-0" />

        <div className="flex min-w-0 flex-1 items-center gap-3">
          {logoUrl && (
            <img src={logoUrl} alt={leagueName} className="h-5 w-5 shrink-0 object-contain" />
          )}
          <div className="min-w-0 flex flex-col leading-tight">
            <h3 className="truncate text-[14px] font-semibold text-[#fafafa]">
              {leagueName}{' '}
              <span className="ml-1 text-[#d7d7d7]/80">({fixtures.length})</span>
            </h3>
            {countryName && (
              <span className="truncate text-[12px] text-[#e8e8e8]/80">{countryName}</span>
            )}
          </div>
        </div>

        {/* Score Spacer */}
        <div className="hidden md:block w-12 shrink-0" />

        <div className="flex items-center gap-2">
          {headerTitle ? (
            <span className="hidden md:block max-w-[160px] truncate text-[11px] font-semibold text-[#e6e6e6] md:max-w-[200px] md:uppercase md:tracking-[0.08em] mr-2">
              {headerTitle}
            </span>
          ) : null}
          <div className={`${marketHeaderClass} grid gap-2 text-[12px] font-semibold text-[#f0f0f0]`}>
            {marketHeaders.map((header) => (
              <span key={header} className="truncate text-center">
                {header}
              </span>
            ))}
          </div>
        </div>

        {/* Plus Button Spacer */}
        <div className="hidden md:block w-8 shrink-0" />
      </div>

      {/* Fixtures List */}
      <div className="flex w-full flex-col">
        {fixtures.map((fixture) => (
          <FixtureRow
            key={fixture.fixture.id}
            fixture={fixture}
            marketView={marketView}
            selectedMarketLabel={selectedMarketLabel}
            selectedMarketHeaders={selectedMarketHeaders}
          />
        ))}
      </div>
    </div>
  );
}
