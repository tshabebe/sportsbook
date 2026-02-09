import { z } from 'zod';

export const retailerLoginSchema = z
  .object({
    username: z.string().min(1),
    password: z.string().min(1),
  })
  .strict();

export const retailTicketParamsSchema = z
  .object({
    ticketId: z.string().min(6).max(64),
  })
  .strict();

export const retailPayoutSchema = z
  .object({
    payoutReference: z.string().min(8).max(128),
  })
  .strict();

export const retailListQuerySchema = z
  .object({
    status: z
      .enum([
        'open',
        'claimed',
        'settled_lost',
        'settled_won_unpaid',
        'paid',
        'void',
        'expired',
      ])
      .optional(),
  })
  .strict();

export type RetailerLoginInput = z.infer<typeof retailerLoginSchema>;
export type RetailTicketParamsInput = z.infer<typeof retailTicketParamsSchema>;
export type RetailPayoutInput = z.infer<typeof retailPayoutSchema>;
export type RetailListQueryInput = z.infer<typeof retailListQuerySchema>;

