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

const reportDateParamSchema = z
  .string()
  .min(1)
  .transform((raw, ctx) => {
    const numeric = Number(raw);
    const date = Number.isFinite(numeric) ? new Date(numeric) : new Date(raw);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid date value',
      });
      return z.NEVER;
    }
    return date;
  });

export const retailReportQuerySchema = z
  .object({
    from: reportDateParamSchema.optional(),
    to: reportDateParamSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.from && value.to && value.from.getTime() > value.to.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['from'],
        message: '`from` must be before `to`',
      });
    }
  });

export type RetailerLoginInput = z.infer<typeof retailerLoginSchema>;
export type RetailTicketParamsInput = z.infer<typeof retailTicketParamsSchema>;
export type RetailPayoutInput = z.infer<typeof retailPayoutSchema>;
export type RetailListQueryInput = z.infer<typeof retailListQuerySchema>;
export type RetailReportQueryInput = z.infer<typeof retailReportQuerySchema>;
