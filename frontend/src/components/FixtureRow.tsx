import { useNavigate } from 'react-router-dom';
import type { Fixture } from '../hooks/useFootball';
import { formatFixtureDate, formatFixtureTime } from '../lib/date';
import { useBetSlip } from '../context/BetSlipContext';

interface FixtureRowProps {
    fixture: Fixture;
}

export function FixtureRow({ fixture }: FixtureRowProps) {
    const navigate = useNavigate();
    const { addToBetSlip, bets } = useBetSlip();

    // Use simplified odds from hook
    const homeOdd = fixture.odds?.home;
    const drawOdd = fixture.odds?.draw;
    const awayOdd = fixture.odds?.away;

    const handleRowClick = () => {
        navigate(`/play/fixture/${fixture.fixture.id}`);
    };

    const handleOddClick = (e: React.MouseEvent, selection: 'Home' | 'Draw' | 'Away') => {
        e.stopPropagation();
        const rawOdd =
            selection === 'Home'
                ? homeOdd
                : selection === 'Draw'
                    ? drawOdd
                    : awayOdd;
        const parsedOdd = Number(rawOdd);
        if (!Number.isFinite(parsedOdd) || parsedOdd <= 1) return;

        const selectionId = `${fixture.fixture.id}-1-${selection}`;
        if (bets.some((b) => b.id === selectionId)) return;

        addToBetSlip({
            id: selectionId,
            fixtureId: fixture.fixture.id,
            betId: 1,
            value: selection,
            odd: parsedOdd,
            bookmakerId: 8,
            fixtureName: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
            marketName: 'Match Winner',
            selectionName:
                selection === 'Home'
                    ? fixture.teams.home.name
                    : selection === 'Draw'
                        ? 'Draw'
                        : fixture.teams.away.name,
            odds: parsedOdd,
        });
    };

    const time = formatFixtureTime(fixture.fixture.date);
    const displayDate = formatFixtureDate(fixture.fixture.date);
    const isLive = ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(fixture.fixture.status.short);

    return (
        <div
            onClick={handleRowClick}
            className="group relative w-full bg-[#1d1d1d] hover:bg-[#252525] transition-colors border-b border-[#333] cursor-pointer"
        >
            {/* Desktop Layout (md+) */}
            <div className="hidden md:flex flex-row items-center w-full px-4 py-3 gap-4">
                {/* Time / Status */}
                <div className="w-16 flex flex-col items-center justify-center shrink-0">
                    {isLive ? (
                        <span className="text-[#ff3939] text-[11px] font-medium bg-[#ff3939]/10 px-1 rounded animate-pulse">
                            {fixture.fixture.status.elapsed}'
                        </span>
                    ) : (
                        <span className="text-[#c8c8c8] text-[12px] font-medium">{time}</span>
                    )}
                </div>

                {/* Teams */}
                <div className="flex-1 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-1">
                        <img src={fixture.teams.home.logo} alt={fixture.teams.home.name} className="w-4 h-4 object-contain" />
                        <span className="text-[#fafafa] text-[13px] font-medium truncate">{fixture.teams.home.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <img src={fixture.teams.away.logo} alt={fixture.teams.away.name} className="w-4 h-4 object-contain" />
                        <span className="text-[#fafafa] text-[13px] font-medium truncate">{fixture.teams.away.name}</span>
                    </div>
                </div>

                {/* Live Score (if applicable) */}
                {(isLive || fixture.goals.home !== null) && (
                    <div className="w-12 flex flex-col items-center justify-center gap-1 font-bold text-[#ffd60a]">
                        <span>{fixture.goals.home ?? 0}</span>
                        <span>{fixture.goals.away ?? 0}</span>
                    </div>
                )}

                {/* 1x2 Odds */}
                <div className="w-64 grid grid-cols-3 gap-2">
                    <OddButton label="1" odd={homeOdd} onClick={(e) => handleOddClick(e, 'Home')} />
                    <OddButton label="X" odd={drawOdd} onClick={(e) => handleOddClick(e, 'Draw')} />
                    <OddButton label="2" odd={awayOdd} onClick={(e) => handleOddClick(e, 'Away')} />
                </div>

                {/* Plus Button for More Markets */}
                <div
                    onClick={handleRowClick}
                    className="w-8 flex items-center justify-center cursor-pointer group/plus"
                >
                    <div className="w-6 h-6 rounded border border-[#333] flex items-center justify-center bg-[#1d1d1d] group-hover/plus:bg-[#333] transition-colors">
                        <svg className="w-4 h-4 text-[#c8c8c8] group-hover/plus:text-[#ffd60a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Mobile Layout (< md) */}
            <div className="md:hidden flex flex-col w-full px-4 py-3 gap-3">
                {/* Top Row: Time & Status */}
                <div className="flex justify-between items-center text-[11px] text-[#c8c8c8]">
                    <div className="flex items-center gap-2">
                        {isLive ? (
                            <span className="text-[#ff3939] font-bold">{fixture.fixture.status.elapsed}' • LIVE</span>
                        ) : (
                            <span>{time} • {displayDate}</span>
                        )}
                    </div>
                    {/* League Name (Small Context) */}
                    <span className="truncate max-w-[150px] opacity-70">{fixture.league.name}</span>
                </div>

                {/* Middle Row: Teams & Score */}
                <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <img src={fixture.teams.home.logo} alt={fixture.teams.home.name} className="w-5 h-5 object-contain" />
                            <span className="text-[#fafafa] text-[14px] font-medium">{fixture.teams.home.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <img src={fixture.teams.away.logo} alt={fixture.teams.away.name} className="w-5 h-5 object-contain" />
                            <span className="text-[#fafafa] text-[14px] font-medium">{fixture.teams.away.name}</span>
                        </div>
                    </div>
                    {(isLive || fixture.goals.home !== null) && (
                        <div className="flex flex-col items-center justify-center gap-2 text-[#ffd60a] font-bold text-[14px]">
                            <span>{fixture.goals.home ?? 0}</span>
                            <span>{fixture.goals.away ?? 0}</span>
                        </div>
                    )}
                </div>

                {/* Bottom Row: Odds */}
                <div className="grid grid-cols-3 gap-2 mt-1">
                    <OddButton label="1" subLabel={fixture.teams.home.name} odd={homeOdd} onClick={(e) => handleOddClick(e, 'Home')} />
                    <OddButton label="X" subLabel="Draw" odd={drawOdd} onClick={(e) => handleOddClick(e, 'Draw')} />
                    <OddButton label="2" subLabel={fixture.teams.away.name} odd={awayOdd} onClick={(e) => handleOddClick(e, 'Away')} />
                </div>
            </div>
        </div>
    );
}

// Sub-component for Odds Button
function OddButton({ label, subLabel, odd, onClick }: { label: string, subLabel?: string, odd: string | number | undefined, onClick: (e: React.MouseEvent) => void }) {
    const displayOdd = odd ? odd : '-';

    return (
        <button
            onClick={onClick}
            className="flex flex-col items-center justify-center bg-[#282828] hover:bg-[#333] active:bg-[#ffd60a]/20 rounded py-2 px-1 transition-colors group/btn h-full w-full"
        >
            <span className="text-[#c8c8c8] text-[10px] mb-0.5 truncate w-full text-center px-1">{subLabel || label}</span>
            <span className="text-[#ffd60a] text-[13px] font-bold group-hover/btn:text-[#ffe55c]">{displayOdd}</span>
        </button>
    );
}
