import { z } from 'zod';

export const betSelectionSchema = z.object({
  fixtureId: z.number().int().positive(),
  betId: z.union([z.number(), z.string()]).optional(),
  value: z.string().min(1),
  odd: z.number().positive(),
  handicap: z.union([z.number(), z.string()]).optional(),
  bookmakerId: z.number().int().optional(),
}).strict();

export const betSlipSchema = z.object({
  selections: z.array(betSelectionSchema).min(1),
  stake: z.number().positive(),
}).strict();

export const settleBetSchema = z.object({
  result: z.enum(['won', 'lost', 'void']),
  payout: z.number().nonnegative().optional(),
}).strict();

export type BetSlipInput = z.infer<typeof betSlipSchema>;
export type BetSelectionInput = z.infer<typeof betSelectionSchema>;
export type SettleBetInput = z.infer<typeof settleBetSchema>;

export type ApiBetSlipInput = BetSlipInput;
export type ApiBetSelectionInput = BetSelectionInput;
export type ApiSettleBetInput = SettleBetInput;
