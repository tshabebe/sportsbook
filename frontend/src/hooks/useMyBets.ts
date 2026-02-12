import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getAuthToken } from '../lib/auth';

export type BetSelectionHistory = {
    id: number;
    betId: number;
    fixtureId: number;
    marketBetId: string;
    value: string;
    odd: string;
    handicap: string | null;
};

export type BetHistoryItem = {
    id: number;
    betRef: string;
    userId: number;
    username: string;
    stake: string;
    status: 'pending' | 'won' | 'lost' | 'void';
    createdAt: string;
    selections: BetSelectionHistory[];
};

export const useMyBets = () =>
    useQuery({
        queryKey: ['my-bets'],
        enabled: Boolean(getAuthToken()),
        queryFn: async () => {
            const { data } = await api.get<{ ok: boolean; bets: BetHistoryItem[] }>('/bets/my');
            return data.bets;
        },
    });
