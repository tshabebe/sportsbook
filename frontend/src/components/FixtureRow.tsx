import { useNavigate } from 'react-router-dom';
import type { Fixture } from '../hooks/useFootball';
import { formatFixtureTime } from '../lib/date';
import { useBetSlip } from '../context/BetSlipContext';

type MarketView = '1x2' | 'double_chance';

type DoubleChanceOdds = {
    homeDraw: string;
    homeAway: string;
    drawAway: string;
};

interface FixtureRowProps {
    fixture: Fixture;
    marketView?: MarketView;
}

export function FixtureRow({ fixture, marketView = '1x2' }: FixtureRowProps) {
    const navigate = useNavigate();
    const { addToBetSlip, bets } = useBetSlip();

    // Use simplified odds from hook
    const homeOdd = fixture.odds?.home;
    const drawOdd = fixture.odds?.draw;
    const awayOdd = fixture.odds?.away;
    const doubleChanceOdds = (fixture.odds as any)?.doubleChance as DoubleChanceOdds | undefined;

    const handleRowClick = () => {
        navigate(`/play/fixture/${fixture.fixture.id}`);
    };

    const handleOddClick = (e: React.MouseEvent, betId: number, selection: string, selectionName: string, rawOdd: string | number | undefined, marketName: string) => {
        e.stopPropagation();
        const parsedOdd = Number(rawOdd);
        if (!Number.isFinite(parsedOdd) || parsedOdd <= 1) return;

        const selectionId = `${fixture.fixture.id}-mw-${betId}-${selection}`;

        addToBetSlip({
            id: selectionId,
            fixtureId: fixture.fixture.id,
            betId,
            value: selection,
            odd: parsedOdd,
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

    const isSelectionActive = (betId: number, selection: string) =>
        bets.some(
            (b) =>
                b.fixtureId === fixture.fixture.id &&
                String(b.betId) === String(betId) &&
                b.value === selection,
        );

    const time = formatFixtureTime(fixture.fixture.date);
    const isLive = ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(fixture.fixture.status.short);

    const market =
        marketView === 'double_chance'
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
                    {market.rows.map((row) => (
                        <OddButton
                            key={row.label}
                            label={row.label}
                            odd={row.odd}
                            showLabel={false}
                            isSelected={isSelectionActive(market.betId, row.selection)}
                            onClick={(e) => handleOddClick(e, market.betId, row.selection, row.selectionName, row.odd, market.marketName)}
                        />
                    ))}
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
                <div className="flex items-center justify-between text-[11px] text-[#c8c8c8]">
                    <span className="flex items-center gap-2 font-semibold text-text-muted">
                        <img src={fixture.league.flag ?? fixture.league.logo} alt={fixture.league.name} className="w-4 h-4 object-contain" />
                        {fixture.league.name}
                    </span>
                    <span className="text-xs">{time}</span>
                </div>

                <div className="flex items-center justify-center gap-3 text-[14px] font-semibold text-text-contrast">
                    <span className="text-sm">{fixture.teams.home.name}</span>
                    <img src={fixture.teams.home.logo} alt={fixture.teams.home.name} className="h-6 w-6 object-contain" />
                    <span className="text-[11px] text-[#8bd2ff] font-medium">VS</span>
                    <img src={fixture.teams.away.logo} alt={fixture.teams.away.name} className="h-6 w-6 object-contain" />
                    <span className="text-sm">{fixture.teams.away.name}</span>
                </div>

                <div className="text-[10px] font-semibold uppercase tracking-[0.4em] text-[#8bd2ff]">{marketView === 'double_chance' ? 'DOUBLE CHANCE' : '1x2'}</div>

                <div className="grid grid-cols-3 gap-2">
                    {market.rows.map((row) => (
                        <OddButton
                            key={row.label}
                            label={row.label}
                            odd={row.odd}
                            isSelected={isSelectionActive(market.betId, row.selection)}
                            onClick={(e) => handleOddClick(e, market.betId, row.selection, row.selectionName, row.odd, market.marketName)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

// Sub-component for Odds Button
function OddButton({ label, subLabel, odd, showLabel = true, isSelected, onClick }: { label: string, subLabel?: string, odd: string | number | undefined, showLabel?: boolean, isSelected?: boolean, onClick: (e: React.MouseEvent) => void }) {
    const displayOdd = odd ? odd : '-';

    return (
        <button
            onClick={onClick}
            className={`flex h-full w-full flex-col items-center justify-center rounded border py-2 px-1 transition-colors group/btn ${
                isSelected
                    ? 'bg-[#ffd60a] border-[#ffd60a] text-[#1d1d1d]'
                    : 'bg-[#3a3a3a] border-[#111] hover:bg-[#4a4a4a] active:bg-[#2b2b2b]'
            }`}
        >
            {showLabel && (
                <span className={`mb-0.5 w-full truncate px-1 text-center text-[10px] ${isSelected ? 'text-[#1d1d1d]/80' : 'text-[#e6e6e6]'}`}>{subLabel || label}</span>
            )}
            <span className={`text-[13px] font-bold ${isSelected ? 'text-[#1d1d1d]' : 'text-[#ffffff]'}`}>{displayOdd}</span>
        </button>
    );
}
