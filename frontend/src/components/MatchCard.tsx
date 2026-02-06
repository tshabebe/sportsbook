import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useBetStore } from "../store/betStore";

interface MatchCardProps {
    fixture: any;
}

export function MatchCard({ fixture }: MatchCardProps) {
    const { addBet } = useBetStore();
    const { fixture: info, teams, goals, odds } = fixture || {};
    const validOdds = odds || { home: "-", draw: "-", away: "-" };

    if (!info || !teams) return null;

    const isLive = info.status?.short === "1H" || info.status?.short === "2H" || info.status?.short === "HT";
    const timeDisplay = isLive ? `${info.status?.elapsed}'` : new Date(info.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const scoreDisplay = isLive ? `${goals.home ?? 0}-${goals.away ?? 0}` : "";

    const handleBet = (selection: "Home" | "Draw" | "Away", oddValue: string) => {
        addBet({
            id: `${info.id}-${selection}`,
            team1: teams.home.name,
            team2: teams.away.name,
            selection: selection === "Home" ? teams.home.name : selection === "Draw" ? "Draw" : teams.away.name,
            odds: parseFloat(oddValue),
            stake: 0
        });
    };

    return (
        <div className="bg-[#1d1d1d] border-b border-[#333] p-3 md:px-4 md:py-2 flex flex-col md:flex-row md:items-center gap-3 relative group">

            {/* Mobile Header: Live Badge + Time + Score + Add Button */}
            <div className="flex items-center justify-between md:hidden">
                <div className="flex items-center gap-2 text-[11px] font-medium">
                    {isLive && (
                        <div className="bg-[#ff3939] text-white px-1 py-0.5 rounded-[2px] leading-tight">
                            Live
                        </div>
                    )}
                    <span className="text-[#c8c8c8]">{timeDisplay}</span>
                    {isLive && <span className="text-[#ffd60a]">{info.status?.short} {scoreDisplay}</span>}
                </div>
                {/* Mobile Add Button (Top Right) */}
                <button className="text-[#E1E1E1] hover:opacity-70">
                    <Plus size={18} />
                </button>
            </div>

            {/* Main Content Container (Desktop: Flex Row, Mobile: Flex Col) */}
            <Link to={`/event/${info.id}`} className="flex-1 flex flex-col md:flex-row md:items-center gap-2 md:gap-6 cursor-pointer group-hover:opacity-100 transition-opacity">

                {/* Desktop Status/Time */}
                <div className="hidden md:flex flex-col text-xs w-16">
                    {isLive ? (
                        <>
                            <div className="bg-[#ff3939] text-white px-1 py-0.5 rounded-[2px] text-center w-fit text-[10px] mb-1">Live</div>
                            <span className="text-[#c8c8c8]">{info.status?.elapsed}'</span>
                        </>
                    ) : (
                        <div className="text-[#c8c8c8] text-[11px]">
                            {new Date(info.date).toLocaleDateString([], { day: 'numeric', month: 'short' })}
                            <br />
                            {timeDisplay}
                        </div>
                    )}
                </div>

                {/* Teams */}
                <div className="flex flex-col justify-center gap-1 md:gap-1 font-medium text-[14px] text-[#fafafa] flex-1">
                    <div className="flex justify-between md:justify-start items-center gap-4">
                        <span>{teams.home.name}</span>
                        {/* Desktop Score (Inline) */}
                        <span className="hidden md:block text-[#ffd60a] font-bold">{goals.home ?? 0}</span>
                    </div>
                    <div className="flex justify-between md:justify-start items-center gap-4">
                        <span>{teams.away.name}</span>
                        {/* Desktop Score (Inline) */}
                        <span className="hidden md:block text-[#ffd60a] font-bold">{goals.away ?? 0}</span>
                    </div>
                </div>
            </Link>


            {/* Odds Buttons */}
            <div className="flex gap-2 w-full md:w-auto mt-1 md:mt-0">
                <OutcomeButton label={teams.home.name} odds={validOdds.home} onClick={() => handleBet("Home", validOdds.home)} />
                <OutcomeButton label="Draw" odds={validOdds.draw} onClick={() => handleBet("Draw", validOdds.draw)} />
                <OutcomeButton label={teams.away.name} odds={validOdds.away} onClick={() => handleBet("Away", validOdds.away)} />
            </div>

            {/* Desktop Add Button */}
            <button className="hidden md:block text-[#E1E1E1] hover:opacity-70 ml-2">
                <Plus size={20} />
            </button>
        </div>
    );
}

function OutcomeButton({ label, odds, onClick }: { label: string, odds: string, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex-1 md:w-[100px] bg-[#0f0f0f] border border-transparent hover:border-[#333] rounded-lg p-2 flex flex-col md:flex-row justify-between items-center transition-all cursor-pointer group/btn"
        >
            <span className="text-[#c8c8c8] text-[11px] font-medium line-clamp-1 text-left w-full md:w-auto group-hover/btn:text-white">{label}</span>
            <span className="text-[#ffd60a] text-[13px] font-semibold">{odds}</span>
        </button>
    );
}
