export type BetMode = 'single' | 'multiple' | 'system';

export interface BetSelectionInput {
  fixtureId: number;
  betId?: number | string;
  value: string;
  odd: number;
  handicap?: number | string;
  bookmakerId?: number;
}

export interface BetSlipInput {
  selections: BetSelectionInput[];
  stake: number;
  mode: BetMode;
  systemSize?: number;
}

export interface SettleBetInput {
  result: 'won' | 'lost' | 'void';
  payout?: number;
}
