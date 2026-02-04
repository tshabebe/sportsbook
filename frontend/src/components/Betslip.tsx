import { useState } from "react";
import { X, ChevronDown } from "lucide-react";
import { useBetStore } from "../store/betStore";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";

interface BetslipProps {
    isOpen?: boolean;
    onClose?: () => void;
    className?: string;
}

export function Betslip({ isOpen = true, onClose, className }: BetslipProps) {
    const [activeTab, setActiveTab] = useState<"single" | "multiple" | "system">("single");
    const { bets, removeBet, updateStake, clearBets } = useBetStore();

    const totalStake = bets.reduce((acc, bet) => acc + bet.stake, 0);
    const potentialWin = bets.reduce((acc, bet) => acc + bet.stake * bet.odds, 0);

    if (!isOpen) return null;

    return (
        <aside className={cn("flex flex-col bg-element-bg w-full h-full border-l border-border-subtle", className)}>
            {/* Header */}
            <div className="flex items-center justify-between bg-element-bg px-4 py-3 border-b border-border-subtle">
                <h2 className="text-text-contrast text-sm font-semibold flex items-center gap-2">
                    Bet Slip
                    <ChevronDown size={16} />
                </h2>
                {onClose && (
                    <button onClick={onClose} className="text-text-muted hover:text-text-contrast transition-colors">
                        <X size={20} />
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border-subtle">
                {(["single", "multiple", "system"] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "flex-1 py-2 text-sm capitalize font-medium transition-colors border-b-2 outline-none",
                            activeTab === tab
                                ? "text-text-contrast border-accent-solid"
                                : "text-text-muted border-transparent hover:text-text-contrast hover:bg-element-hover-bg"
                        )}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Bets List */}
            <div className="flex-1 overflow-y-auto">
                {bets.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-text-muted text-sm px-4 text-center">
                        Add selections to your bet slip to get started
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 p-4">
                        {bets.map((bet) => (
                            <div
                                key={bet.id}
                                className="flex flex-col bg-element-hover-bg/50 rounded-lg p-3 gap-2 border border-border-subtle"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="text-text-contrast text-sm font-medium">
                                            {bet.team1} - {bet.team2}
                                        </div>
                                        <div className="text-text-muted text-xs mt-1">
                                            {bet.selection}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeBet(bet.id)}
                                        className="text-text-muted hover:text-text-contrast transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={bet.stake || ""}
                                        onChange={(e) =>
                                            updateStake(bet.id, parseFloat(e.target.value) || 0)
                                        }
                                        placeholder="0.00"
                                        className="flex-1 bg-element-bg text-text-contrast px-3 py-2 rounded-md text-sm outline-none border border-border-subtle focus:border-accent-solid transition-colors"
                                    />
                                    <div className="text-accent-solid text-sm font-semibold">
                                        {bet.odds.toFixed(2)}
                                    </div>
                                </div>
                                <div className="text-right text-text-muted text-xs">
                                    Potential: {(bet.stake * bet.odds).toFixed(2)}€
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer Summary */}
            {bets.length > 0 && (
                <div className="border-t border-border-subtle p-4 bg-element-bg">
                    <div className="flex flex-col gap-2 text-sm mb-4">
                        <div className="flex justify-between text-text-muted">
                            <span>Total bets</span>
                            <span className="text-text-contrast">{bets.length}</span>
                        </div>
                        <div className="flex justify-between text-text-muted">
                            <span>Total Stake</span>
                            <span className="text-text-contrast">{totalStake.toFixed(2)}€</span>
                        </div>
                        <div className="flex justify-between text-text-contrast font-semibold">
                            <span>Potential Win</span>
                            <span className="text-accent-solid">{potentialWin.toFixed(2)}€</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Button variant="solid" className="w-full">
                            Place Bet
                        </Button>
                        <Button variant="ghost" className="w-full text-text-muted hover:bg-element-hover-bg" onPress={clearBets}>
                            Clear All
                        </Button>
                    </div>
                </div>
            )}
        </aside>
    );
}
