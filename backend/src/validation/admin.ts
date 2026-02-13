import { z } from 'zod';

export const adminLoginSchema = z
  .object({
    username: z.string().min(1),
    password: z.string().min(1),
  })
  .strict();

export const adminCashierCreateSchema = z
  .object({
    name: z.string().min(2).max(120),
    username: z.string().min(3).max(80),
    password: z.string().min(6).max(200),
    isActive: z.boolean().optional(),
  })
  .strict();

export const adminCashierParamsSchema = z
  .object({
    cashierId: z
      .string()
      .min(1)
      .transform((value, ctx) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid cashier id',
          });
          return z.NEVER;
        }
        return parsed;
      }),
  })
  .strict();

export const adminCashierPasswordSchema = z
  .object({
    password: z.string().min(6).max(200),
  })
  .strict();

export const adminCashierStatusSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

const dateParamSchema = z
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

export const adminCashierListQuerySchema = z
  .object({
    from: dateParamSchema.optional(),
    to: dateParamSchema.optional(),
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

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type AdminCashierCreateInput = z.infer<typeof adminCashierCreateSchema>;
export type AdminCashierParamsInput = z.infer<typeof adminCashierParamsSchema>;
export type AdminCashierPasswordInput = z.infer<typeof adminCashierPasswordSchema>;
export type AdminCashierStatusInput = z.infer<typeof adminCashierStatusSchema>;
export type AdminCashierListQueryInput = z.infer<typeof adminCashierListQuerySchema>;
