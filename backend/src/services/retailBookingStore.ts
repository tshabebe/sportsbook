import { z } from 'zod';
import { cacheGet, cacheSet } from './cache';
import { config } from './config';

const RETAIL_BOOKING_KEY_PREFIX = 'retail:booking:v1';

const retailBookingPayloadSchema = z
  .object({
    bookCode: z.string().min(6).max(64),
    slipJson: z.unknown(),
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .strict();

export type RetailBookingRecord = z.infer<typeof retailBookingPayloadSchema>;

const retailBookingKey = (bookCode: string): string =>
  `${RETAIL_BOOKING_KEY_PREFIX}:${bookCode}`;

export const createRetailBooking = async (input: {
  bookCode: string;
  slipJson: unknown;
  now?: Date;
  ttlSeconds?: number;
}): Promise<RetailBookingRecord> => {
  const now = input.now ?? new Date();
  const ttlSeconds = Math.max(
    60,
    Number.isFinite(input.ttlSeconds) ? Number(input.ttlSeconds) : config.retailBookingTtlSeconds,
  );
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
  const payload: RetailBookingRecord = retailBookingPayloadSchema.parse({
    bookCode: input.bookCode,
    slipJson: input.slipJson,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  await cacheSet(
    retailBookingKey(input.bookCode),
    JSON.stringify(payload),
    ttlSeconds,
  );

  return payload;
};

export const getRetailBookingByBookCode = async (
  bookCode: string,
): Promise<RetailBookingRecord | null> => {
  const raw = await cacheGet(retailBookingKey(bookCode));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    const validated = retailBookingPayloadSchema.safeParse(parsed);
    if (!validated.success) return null;
    return validated.data;
  } catch {
    return null;
  }
};
