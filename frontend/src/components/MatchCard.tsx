import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Button } from "./ui/Button";
import { useBetStore } from "../store/betStore";
import { cn } from "../lib/utils";

interface MatchCardProps {
    fixture: any; // Using simplified any for the merged object for now, ideally strictly typed
}

export function MatchCard({ fixture }: MatchCardProps) {
    const { addBet } = useBetStore();
    const { fixture: info, teams, goals, odds } = fixture || {};
    const validOdds = odds || { home: "-", draw: "-", away: "-" };

    if (!info || !teams) return null; // Guard clause

    // Format logic (elapsed time, score)
    const isLive = info.status?.short === "1H" || info.status?.short === "2H" || info.status?.short === "HT";
    const timeDisplay = isLive ? `${info.status?.elapsed}'` : info.status?.short;

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
        <div className="flex flex-col md:flex-row md:items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/5 px-2 rounded-lg transition-colors gap-3 md:gap-0">

            {/* Match Info */}
            <Link to={`/event/${info.id}`} className="flex-1 flex items-center justify-between md:justify-start gap-4 group cursor-pointer">
                {/* Time/Status */}
                <div className="flex flex-col items-center w-12 text-xs">
                    {isLive ? (
                        <>
                            <span className="text-accent-solid animate-pulse font-bold">{timeDisplay}</span>
                            <span className="text-text-muted text-[10px]">LIVE</span>
                        </>
                    ) : (
                        <span className="text-text-muted">{new Date(info.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                </div>

                {/* Teams */}
                <div className="flex flex-col gap-1 flex-1">
                    <div className="flex justify-between items-center w-full md:w-64">
                        <div className="flex items-center gap-2">
                            {/* Placeholder Logo or Img */}
                            <span className="text-text-contrast text-sm font-medium group-hover:text-accent-solid transition-colors">{teams.home.name}</span>
                        </div>
                        <span className="text-accent-solid font-bold">{goals.home ?? 0}</span>
                    </div>
                    <div className="flex justify-between items-center w-full md:w-64">
                        <div className="flex items-center gap-2">
                            <span className="text-text-contrast text-sm font-medium group-hover:text-accent-solid transition-colors">{teams.away.name}</span>
                        </div>
                        <span className="text-accent-solid font-bold">{goals.away ?? 0}</span>
                    </div>
                </div>
            </Link>

            {/* Functionality: Odds Buttons */}
            <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 md:w-16 h-8 text-xs bg-element-bg border-border-subtle hover:border-accent-solid hover:bg-element-hover-bg"
                    onPress={() => handleBet("Home", validOdds.home)}
                >
                    <span className="text-text-muted mr-1">1</span>
                    <span className="text-accent-solid font-bold">{validOdds.home}</span>
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 md:w-16 h-8 text-xs bg-element-bg border-border-subtle hover:border-accent-solid hover:bg-element-hover-bg"
                    onPress={() => handleBet("Draw", validOdds.draw)}
                >
                    <span className="text-text-muted mr-1">X</span>
                    <span className="text-accent-solid font-bold">{validOdds.draw}</span>
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 md:w-16 h-8 text-xs bg-element-bg border-border-subtle hover:border-accent-solid hover:bg-element-hover-bg"
                    onPress={() => handleBet("Away", validOdds.away)}
                >
                    <span className="text-text-muted mr-1">2</span>
                    <span className="text-accent-solid font-bold">{validOdds.away}</span>
                </Button>

                <Link to={`/event/${info.id}`} className="hidden md:flex text-text-muted hover:text-text-contrast">
                    <ChevronRight size={16} />
                </Link>
            </div>

        </div>
    );
}
