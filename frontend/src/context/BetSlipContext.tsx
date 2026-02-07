import { createContext, useContext, useState, type ReactNode } from 'react';

export interface Bet {
    id: string; // Unique ID (fixtureId-marketId-outcomeId)
    fixtureId: number;
    fixtureName: string; // e.g., "Team A vs Team B"
    marketName: string;
    selectionName: string; // e.g., "Team A"
    odds: string; // e.g., "2.50"
    stake?: number;
}

interface BetSlipContextType {
    bets: Bet[];
    addToBetSlip: (bet: Bet) => void;
    removeFromBetSlip: (betId: string) => void;
    clearBetSlip: () => void;
    isOpen: boolean;
    toggleBetSlip: () => void;
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

    return (
        <BetSlipContext.Provider value={{ bets, addToBetSlip, removeFromBetSlip, clearBetSlip, isOpen, toggleBetSlip }}>
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
