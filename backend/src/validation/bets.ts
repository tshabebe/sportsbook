import { z } from 'zod';

export const betSelectionSchema = z.object({
  fixtureId: z.number().int().positive(),
  betId: z.union([z.number(), z.string()]).optional(),
  value: z.string().min(1),
  odd: z.number().positive(),
  handicap: z.union([z.number(), z.string()]).optional(),
  bookmakerId: z.number().int().optional(),
});

export const betSlipSchema = z.object({
  selections: z.array(betSelectionSchema).min(1),
  stake: z.number().positive(),
});

export type BetSlipInput = z.infer<typeof betSlipSchema>;
export type BetSelectionInput = z.infer<typeof betSelectionSchema>;
