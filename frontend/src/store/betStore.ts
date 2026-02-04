import { create } from 'zustand';

export interface Bet {
    id: string;
    team1: string;
    team2: string;
    selection: string;
    odds: number;
    stake: number;
}

interface BetState {
    bets: Bet[];
    addBet: (bet: Bet) => void;
    removeBet: (id: string) => void;
    updateStake: (id: string, stake: number) => void;
    clearBets: () => void;
}

export const useBetStore = create<BetState>((set) => ({
    bets: [],
    addBet: (bet) =>
        set((state) => {
            const existingBet = state.bets.find((b) => b.id === bet.id);
            if (existingBet) return state;
            return { bets: [...state.bets, bet] };
        }),
    removeBet: (id) =>
        set((state) => ({
            bets: state.bets.filter((bet) => bet.id !== id),
        })),
    updateStake: (id, stake) =>
        set((state) => ({
            bets: state.bets.map((bet) => (bet.id === id ? { ...bet, stake } : bet)),
        })),
    clearBets: () => set({ bets: [] }),
}));
