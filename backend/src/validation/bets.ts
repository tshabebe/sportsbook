import { z } from 'zod';

export const betModeSchema = z.enum(['single', 'multiple', 'system']);

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
  mode: betModeSchema.default('multiple'),
  systemSize: z.number().int().min(2).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.mode === 'single' && value.selections.length < 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['selections'],
      message: 'Single mode requires at least one selection',
    });
  }
  if (value.mode === 'multiple' && value.selections.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['selections'],
      message: 'Multiple mode requires at least two selections',
    });
  }
  if (value.mode === 'system') {
    if (value.selections.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['selections'],
        message: 'System mode requires at least three selections',
      });
    }
    if (!value.systemSize) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['systemSize'],
        message: 'System mode requires systemSize',
      });
    } else if (value.systemSize > value.selections.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['systemSize'],
        message: 'systemSize cannot exceed selection count',
      });
    }
  }
});

export const settleBetSchema = z.object({
  result: z.enum(['won', 'lost', 'void']),
  payout: z.number().nonnegative().optional(),
}).strict();

export type BetSlipInput = z.infer<typeof betSlipSchema>;
export type BetSelectionInput = z.infer<typeof betSelectionSchema>;
export type SettleBetInput = z.infer<typeof settleBetSchema>;
export type BetMode = z.infer<typeof betModeSchema>;

export type ApiBetSlipInput = BetSlipInput;
export type ApiBetSelectionInput = BetSelectionInput;
export type ApiSettleBetInput = SettleBetInput;
export type ApiBetMode = BetMode;
