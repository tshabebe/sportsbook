import { useState } from 'react';
import type { Fixture } from '../hooks/useFootball';
import { FixtureRow } from './FixtureRow';

interface LeagueGroupProps {
    leagueName: string;
    leagueLogo?: string;
    countryFlag?: string;
    fixtures: Fixture[];
    defaultExpanded?: boolean;
}

export function LeagueGroup({ leagueName, countryFlag, fixtures, defaultExpanded = true }: LeagueGroupProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    // Fallback logo if country flag is missing
    const logoUrl = countryFlag || fixtures[0]?.league.logo;

    return (
        <div className="w-full flex flex-col mb-4 bg-[#1d1d1d] rounded-lg overflow-hidden border border-[#333]">
            {/* League Header */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between px-4 py-3 bg-[#282828] cursor-pointer hover:bg-[#333] transition-colors"
            >
                <div className="flex items-center gap-3">
                    {logoUrl && <img src={logoUrl} alt={leagueName} className="w-5 h-5 object-contain" />}
                    <h3 className="text-[#fafafa] font-semibold text-[14px]">{leagueName}</h3>
                    <span className="bg-[#1d1d1d] text-[#c8c8c8] text-[10px] px-2 py-0.5 rounded-full border border-[#333]">
                        {fixtures.length}
                    </span>
                </div>

                {/* Chevron */}
                <div className={`text-[#c8c8c8] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </div>
            </div>

            {/* Fixtures List */}
            <div className={`flex flex-col w-full transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                {fixtures.map((fixture) => (
                    <FixtureRow key={fixture.fixture.id} fixture={fixture} />
                ))}
            </div>
        </div>
    );
}
