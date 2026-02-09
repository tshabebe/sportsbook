import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useBetSlip } from "../context/BetSlipContext";
import { Button } from "./ui/Button";
import { cn } from "../lib/utils";
import { api } from "../lib/api";

type BetType = "single" | "multiple" | "system";

// Generate all combinations of size k from array
function getCombinations<T>(arr: T[], k: number): T[][] {
    if (k === 1) return arr.map(el => [el]);
    if (k === arr.length) return [arr];
    if (k > arr.length) return [];

    const result: T[][] = [];
    for (let i = 0; i <= arr.length - k; i++) {
        const head = arr[i];
        const tailCombos = getCombinations(arr.slice(i + 1), k - 1);
        for (const combo of tailCombos) {
            result.push([head, ...combo]);
        }
    }
    return result;
}

interface BetslipProps {
    isOpen?: boolean;
    onClose?: () => void;
    className?: string;
}

export function Betslip({ isOpen = true, onClose, className }: BetslipProps) {
    const [activeTab, setActiveTab] = useState<BetType>("single");
    const [stake, setStake] = useState<number>(0);
    const [systemSize, setSystemSize] = useState<number>(2); // For system bets
    const [isPlacing, setIsPlacing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { bets, removeFromBetSlip, clearBetSlip, toBetSlipInput } = useBetSlip();

    // Calculate based on bet type
    const calculateBet = () => {
        if (bets.length === 0 || stake <= 0) {
            return { totalStake: 0, potentialWin: 0, numBets: 0, combinedOdds: 1 };
        }

        if (activeTab === "single") {
            // Single: Each bet is independent
            const stakePerBet = stake / bets.length;
            const potentialWin = bets.reduce((acc, bet) => acc + stakePerBet * bet.odds, 0);
            return { totalStake: stake, potentialWin, numBets: bets.length, combinedOdds: 0 };
        }

        if (activeTab === "multiple") {
            // Multiple: All selections combined
            if (bets.length < 2) {
                return { totalStake: stake, potentialWin: 0, numBets: 0, combinedOdds: 0, error: "Need 2+ selections" };
            }
            const combinedOdds = bets.reduce((acc, bet) => acc * bet.odds, 1);
            const potentialWin = stake * combinedOdds;
            return { totalStake: stake, potentialWin, numBets: 1, combinedOdds };
        }

        if (activeTab === "system") {
            // System: All combinations of systemSize
            if (bets.length < 3) {
                return { totalStake: stake, potentialWin: 0, numBets: 0, combinedOdds: 0, error: "Need 3+ selections" };
            }
            const combos = getCombinations(bets, systemSize);
            if (combos.length === 0) {
                return { totalStake: stake, potentialWin: 0, numBets: 0, combinedOdds: 0, error: "Invalid system" };
            }
            const stakePerCombo = stake / combos.length;
            const potentialWin = combos.reduce((acc, combo) => {
                const comboOdds = combo.reduce((o, bet) => o * bet.odds, 1);
                return acc + stakePerCombo * comboOdds;
            }, 0);
            return { totalStake: stake, potentialWin, numBets: combos.length, combinedOdds: 0 };
        }

        return { totalStake: 0, potentialWin: 0, numBets: 0, combinedOdds: 0 };
    };

    const calculation = calculateBet();

    // Place bet handler
    const handlePlaceBet = async () => {
        if (stake <= 0 || bets.length === 0) return;

        setIsPlacing(true);
        setError(null);

        try {
            // First validate
            const validatePayload = toBetSlipInput(stake);
            const validateRes = await api.post('/betslip/validate', validatePayload);

            if (!validateRes.data.ok) {
                setError(validateRes.data.results?.[0]?.error || 'Validation failed');
                return;
            }

            // Then place
            const placeRes = await api.post('/betslip/place', validatePayload);

            if (!placeRes.data.ok) {
                setError(placeRes.data.error?.message || 'Failed to place bet');
                return;
            }

            // Success - clear bet slip
            clearBetSlip();
            setStake(0);
            // TODO: Show success toast
        } catch (err: any) {
            setError(err.response?.data?.error?.message || 'Failed to place bet');
        } finally {
            setIsPlacing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <aside className={cn("flex flex-col bg-element-bg w-full h-full border-l border-border-subtle", className)}>
            {/* Header */}
            <div className="flex items-center justify-between bg-element-bg px-4 py-3 border-b border-border-subtle">
                <h2 className="text-text-contrast text-sm font-semibold flex items-center gap-2">
                    Bet Slip
                    <span className="bg-accent-solid text-[#1d1d1d] text-xs px-2 py-0.5 rounded-full">
                        {bets.length}
                    </span>
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
                        disabled={
                            (tab === "multiple" && bets.length < 2) ||
                            (tab === "system" && bets.length < 3)
                        }
                        className={cn(
                            "flex-1 py-2 text-sm capitalize font-medium transition-colors border-b-2 outline-none",
                            activeTab === tab
                                ? "text-text-contrast border-accent-solid"
                                : "text-text-muted border-transparent hover:text-text-contrast hover:bg-element-hover-bg",
                            ((tab === "multiple" && bets.length < 2) || (tab === "system" && bets.length < 3))
                            && "opacity-50 cursor-not-allowed"
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
                                            {bet.fixtureName}
                                        </div>
                                        <div className="text-text-muted text-xs mt-1">
                                            {bet.marketName}: {bet.selectionName}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeFromBetSlip(bet.id)}
                                        className="text-text-muted hover:text-text-contrast transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-accent-solid text-sm font-semibold">
                                        @ {bet.odds.toFixed(2)}
                                    </span>
                                    {activeTab === "single" && (
                                        <span className="text-text-muted text-xs">
                                            Stake: €{(stake / bets.length).toFixed(2)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* System Size Selector */}
            {activeTab === "system" && bets.length >= 3 && (
                <div className="px-4 py-2 border-t border-border-subtle">
                    <label className="text-text-muted text-xs block mb-1">System Type</label>
                    <select
                        value={systemSize}
                        onChange={(e) => setSystemSize(Number(e.target.value))}
                        className="w-full bg-element-bg text-text-contrast px-3 py-2 rounded-md text-sm border border-border-subtle"
                    >
                        {Array.from({ length: bets.length - 1 }, (_, i) => i + 2).map((size) => {
                            const numCombos = getCombinations(bets, size).length;
                            return (
                                <option key={size} value={size}>
                                    {size}/{bets.length} ({numCombos} bets)
                                </option>
                            );
                        })}
                    </select>
                </div>
            )}

            {/* Footer Summary */}
            {bets.length > 0 && (
                <div className="border-t border-border-subtle p-4 bg-element-bg">
                    {/* Stake Input */}
                    <div className="mb-4">
                        <label className="text-text-muted text-xs block mb-1">Total Stake</label>
                        <input
                            type="number"
                            value={stake || ""}
                            onChange={(e) => setStake(parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                            className="w-full bg-element-bg text-text-contrast px-3 py-2 rounded-md text-sm outline-none border border-border-subtle focus:border-accent-solid transition-colors"
                        />
                    </div>

                    {/* Quick Stake Buttons */}
                    <div className="flex gap-2 mb-4">
                        {[10, 25, 50, 100].map((amount) => (
                            <button
                                key={amount}
                                onClick={() => setStake(amount)}
                                className="flex-1 py-1.5 text-xs bg-element-hover-bg text-text-muted rounded hover:bg-accent-solid hover:text-[#1d1d1d] transition-colors"
                            >
                                €{amount}
                            </button>
                        ))}
                    </div>

                    {/* Summary */}
                    <div className="flex flex-col gap-2 text-sm mb-4">
                        <div className="flex justify-between text-text-muted">
                            <span>Bet Type</span>
                            <span className="text-text-contrast capitalize">{activeTab}</span>
                        </div>
                        {activeTab === "multiple" && calculation.combinedOdds > 0 && (
                            <div className="flex justify-between text-text-muted">
                                <span>Combined Odds</span>
                                <span className="text-text-contrast">{calculation.combinedOdds.toFixed(2)}</span>
                            </div>
                        )}
                        {activeTab !== "multiple" && (
                            <div className="flex justify-between text-text-muted">
                                <span>Number of Bets</span>
                                <span className="text-text-contrast">{calculation.numBets}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-text-muted">
                            <span>Total Stake</span>
                            <span className="text-text-contrast">€{calculation.totalStake.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-text-contrast font-semibold">
                            <span>Potential Win</span>
                            <span className="text-accent-solid">€{calculation.potentialWin.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="text-red-500 text-xs mb-3 p-2 bg-red-500/10 rounded">
                            {error}
                        </div>
                    )}

                    {/* Calculation Error */}
                    {'error' in calculation && calculation.error && (
                        <div className="text-yellow-500 text-xs mb-3">
                            {calculation.error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                        <Button
                            variant="solid"
                            className="w-full"
                            onPress={handlePlaceBet}
                            isDisabled={stake <= 0 || isPlacing || ('error' in calculation && !!calculation.error)}
                        >
                            {isPlacing ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Placing...
                                </span>
                            ) : (
                                'Place Bet'
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full text-text-muted hover:bg-element-hover-bg"
                            onPress={clearBetSlip}
                        >
                            Clear All
                        </Button>
                    </div>
                </div>
            )}
        </aside>
    );
}
