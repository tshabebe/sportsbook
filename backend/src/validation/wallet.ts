import { z } from 'zod';

export const walletDebitSchema = z.object({
  user_id: z.coerce.number().int().positive().optional(),
  chatId: z.coerce.number().int().positive().optional(),
  username: z.string().min(1).optional(),
  amount: z.coerce.number().positive(),
  game: z.string().min(1).optional(),
  round_id: z.string().min(1),
  transaction_id: z.string().min(1),
});

export const walletCreditSchema = walletDebitSchema.extend({
  debit_transaction_id: z.string().min(1),
});

export type WalletDebitInput = z.infer<typeof walletDebitSchema>;
export type WalletCreditInput = z.infer<typeof walletCreditSchema>;
