import { createContext, useContext, useState, type ReactNode } from 'react';
import type { BetSelectionInput, BetSlipInput } from '../types/backendSchemas';

export interface Bet extends BetSelectionInput {
    id: string; // Unique ID (fixtureId-marketId-outcomeId)
    fixtureName: string; // e.g., "Team A vs Team B"
    marketName: string;
    selectionName: string; // e.g., "Team A"
    odds: number;
    stake?: number;
}

interface BetSlipContextType {
    bets: Bet[];
    addToBetSlip: (bet: Bet) => void;
    removeFromBetSlip: (betId: string) => void;
    clearBetSlip: () => void;
    isOpen: boolean;
    toggleBetSlip: () => void;
    toBetSlipInput: (stake: number) => BetSlipInput;
}

const BetSlipContext = createContext<BetSlipContextType | undefined>(undefined);

export function BetSlipProvider({ children }: { children: ReactNode }) {
    const [bets, setBets] = useState<Bet[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    const addToBetSlip = (bet: Bet) => {
        setBets(currentBets => {
            if (currentBets.some(b => b.id === bet.id)) return currentBets;
            return [...currentBets, bet];
        });
        setIsOpen(true);
    };

    const removeFromBetSlip = (betId: string) => {
        setBets(currentBets => currentBets.filter(b => b.id !== betId));
    };

    const clearBetSlip = () => {
        setBets([]);
    };

    const toggleBetSlip = () => {
        setIsOpen(prev => !prev);
    };

    const toBetSlipInput = (stake: number): BetSlipInput => ({
        stake,
        selections: bets.map((bet) => ({
            fixtureId: bet.fixtureId,
            betId: bet.betId,
            value: bet.value,
            odd: bet.odd,
            handicap: bet.handicap,
            bookmakerId: bet.bookmakerId,
        })),
    });

    return (
        <BetSlipContext.Provider value={{ bets, addToBetSlip, removeFromBetSlip, clearBetSlip, isOpen, toggleBetSlip, toBetSlipInput }}>
            {children}
        </BetSlipContext.Provider>
    );
}

export function useBetSlip() {
    const context = useContext(BetSlipContext);
    if (context === undefined) {
        throw new Error('useBetSlip must be used within a BetSlipProvider');
    }
    return context;
}
