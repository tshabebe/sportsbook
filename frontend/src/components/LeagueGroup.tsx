import { useState } from 'react';
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
  defaultExpanded = true,
  marketView = '1x2',
  selectedMarketLabel,
  selectedMarketHeaders,
}: LeagueGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

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
  const marketHeaderClass =
    marketHeaders.length === 2 ? 'w-52 grid grid-cols-2' : 'w-64 grid grid-cols-3';
  const headerTitle = isExtraMarketView(marketView) ? selectedMarketLabel : null;

  return (
    <div className="mb-2 flex w-full flex-col overflow-hidden rounded-lg border border-[#333] bg-[#1d1d1d]">
      {/* League Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex cursor-pointer items-center justify-between bg-gradient-to-b from-[#2f5e1f] to-[#173a10] px-4 py-2 transition-colors hover:from-[#376a24] hover:to-[#1b4512]"
      >
        <div className="flex min-w-0 items-center gap-3">
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

        <div className="flex items-center gap-2">
          {headerTitle ? (
            <span className="max-w-[160px] truncate text-[11px] font-semibold text-[#e6e6e6] md:max-w-[200px] md:uppercase md:tracking-[0.08em]">
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
          {/* Chevron */}
          <div
            className={`flex w-8 items-center justify-center text-[#e6e6e6] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Fixtures List */}
      <div
        className={`flex w-full flex-col transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
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
