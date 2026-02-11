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
    leagueName?: string;
    leagueCountry?: string;
    fixtureDate?: string;
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
                    const sameSelectionIndex = state.bets.findIndex((b) => b.id === bet.id);
                    if (sameSelectionIndex >= 0) {
                        // Toggle off when clicking an already selected outcome.
                        return {
                            ...state,
                            bets: state.bets.filter((b) => b.id !== bet.id),
                        };
                    }

                    // Sportsbook behavior: one active outcome per fixture+market in a ticket.
                    const withoutSameMarket = state.bets.filter(
                        (b) => !(b.fixtureId === bet.fixtureId && String(b.betId) === String(bet.betId)),
                    );

                    return { ...state, bets: [...withoutSameMarket, bet], isOpen: true };
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
