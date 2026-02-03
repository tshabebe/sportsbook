import { BetSlipInput } from '../validation/bets';

type BetSlip = BetSlipInput;

type StoredBet = {
  id: string;
  createdAt: string;
  status: 'pending' | 'accepted' | 'rejected' | 'settled';
  slip: BetSlip;
};

const bets: StoredBet[] = [];

const generateId = () =>
  `bet_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const placeBet = (slip: BetSlip, status: StoredBet['status']): StoredBet => {
  const bet: StoredBet = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    status,
    slip,
  };
  bets.unshift(bet);
  return bet;
};

export const listBets = (): StoredBet[] => bets;

export const getBet = (id: string): StoredBet | undefined =>
  bets.find((b) => b.id === id);

export type { BetSlip, StoredBet };
