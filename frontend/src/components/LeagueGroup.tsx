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
}

type MarketView = '1x2' | 'double_chance';

export function LeagueGroup({ leagueName, leagueLogo, countryFlag, fixtures, defaultExpanded = true, marketView = '1x2' }: LeagueGroupProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    // Fallback logo if country flag is missing
    const logoUrl = countryFlag || leagueLogo || fixtures[0]?.league.flag || fixtures[0]?.league.logo;
    const countryName = fixtures[0]?.league.country;

    return (
        <div className="w-full flex flex-col mb-2 bg-[#1d1d1d] rounded-lg overflow-hidden border border-[#333]">
            {/* League Header */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between px-4 py-2 cursor-pointer transition-colors bg-gradient-to-b from-[#2f5e1f] to-[#173a10] hover:from-[#376a24] hover:to-[#1b4512]"
            >
                <div className="flex min-w-0 items-center gap-3">
                    {logoUrl && <img src={logoUrl} alt={leagueName} className="w-5 h-5 object-contain shrink-0" />}
                    <div className="min-w-0 flex flex-col leading-tight">
                        <h3 className="text-[#fafafa] font-semibold text-[14px] truncate">
                            {leagueName}{' '}
                            <span className="text-[#d7d7d7]/80 ml-1">({fixtures.length})</span>
                        </h3>
                        {countryName && <span className="text-[#e8e8e8]/80 text-[12px] truncate">{countryName}</span>}
                    </div>
                </div>


                <div className="flex items-center gap-2">
                    <div className="w-64 grid grid-cols-3 gap-2 text-[#f0f0f0] text-[12px] font-semibold">
                        {marketView === '1x2' ? (
                            <>
                                <span className="text-center">1</span>
                                <span className="text-center">X</span>
                                <span className="text-center">2</span>
                            </>
                        ) : (
                            <>
                                <span className="text-center">1/X</span>
                                <span className="text-center">1/2</span>
                                <span className="text-center">X/2</span>
                            </>
                        )}
                    </div>
                    {/* Chevron */}
                    <div className={`w-8 flex items-center justify-center text-[#e6e6e6] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                </div>
            </div>


            {/* Fixtures List */}
            <div className={`flex flex-col w-full transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                {fixtures.map((fixture) => (
                    <FixtureRow key={fixture.fixture.id} fixture={fixture} marketView={marketView} />
                ))}
            </div>
        </div>
    );
}
