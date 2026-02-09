import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BetSelectionInput, BetSlipInput } from '../types/backendSchemas';

export interface Bet extends BetSelectionInput {
    id: string; // Unique ID (fixtureId-marketId-outcomeId)
    fixtureName: string; // e.g., "Team A vs Team B"
    marketName: string;
    selectionName: string; // e.g., "Team A"
    odds: number;
    stake?: number;
}

interface BetSlipStore {
    bets: Bet[];
    isOpen: boolean;
    addToBetSlip: (bet: Bet) => void;
    removeFromBetSlip: (betId: string) => void;
    clearBetSlip: () => void;
    toggleBetSlip: () => void;
    toBetSlipInput: (
        stake: number,
        mode: BetSlipInput['mode'],
        systemSize?: number
    ) => BetSlipInput;
}

export const useBetSlip = create<BetSlipStore>()(
    persist(
        (set, get) => ({
            bets: [],
            isOpen: false,
            addToBetSlip: (bet) => {
                set((state) => {
                    if (state.bets.some((b) => b.id === bet.id)) return state;
                    return { ...state, bets: [...state.bets, bet], isOpen: true };
                });
            },
            removeFromBetSlip: (betId) => {
                set((state) => ({
                    ...state,
                    bets: state.bets.filter((bet) => bet.id !== betId),
                }));
            },
            clearBetSlip: () => {
                set((state) => ({ ...state, bets: [] }));
            },
            toggleBetSlip: () => {
                set((state) => ({ ...state, isOpen: !state.isOpen }));
            },
            toBetSlipInput: (stake, mode, systemSize) => ({
                stake,
                mode,
                systemSize: mode === 'system' ? systemSize : undefined,
                selections: get().bets.map((bet) => ({
                    fixtureId: bet.fixtureId,
                    betId: bet.betId,
                    value: bet.value,
                    odd: bet.odd,
                    handicap: bet.handicap,
                    bookmakerId: bet.bookmakerId,
                })),
            }),
        }),
        {
            name: 'betslip-store-v1',
            partialize: (state) => ({ bets: state.bets, isOpen: state.isOpen }),
        },
    ),
);
