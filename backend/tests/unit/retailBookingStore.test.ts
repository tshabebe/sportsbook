import { beforeEach, describe, expect, it, vi } from 'vitest';

const memory = new Map<string, string>();

vi.mock('../../src/services/cache', () => ({
  cacheGet: vi.fn(async (key: string) => memory.get(key) ?? null),
  cacheSet: vi.fn(async (key: string, value: string) => {
    memory.set(key, value);
  }),
}));

import { cacheSet } from '../../src/services/cache';
import {
  createRetailBooking,
  getRetailBookingByBookCode,
} from '../../src/services/retailBookingStore';

describe('retailBookingStore', () => {
  beforeEach(() => {
    memory.clear();
    vi.clearAllMocks();
  });

  it('stores and loads booking payload from redis cache', async () => {
    const booking = await createRetailBooking({
      bookCode: '11-030686',
      slipJson: {
        mode: 'multiple',
        stake: 10,
        selections: [
          {
            fixtureId: 1234,
            betId: 1,
            value: 'Home',
            odd: 2.1,
            bookmakerId: 8,
          },
          {
            fixtureId: 1235,
            betId: 1,
            value: 'Away',
            odd: 1.9,
            bookmakerId: 8,
          },
        ],
      },
      ttlSeconds: 90,
      now: new Date('2026-02-13T10:00:00.000Z'),
    });

    expect(booking.bookCode).toBe('11-030686');
    expect(booking.createdAt).toBe('2026-02-13T10:00:00.000Z');
    expect(booking.expiresAt).toBe('2026-02-13T10:01:30.000Z');

    const loaded = await getRetailBookingByBookCode('11-030686');
    expect(loaded).not.toBeNull();
    expect(loaded?.bookCode).toBe('11-030686');
    expect(loaded?.slipJson).toEqual(booking.slipJson);

    const cacheSetMock = vi.mocked(cacheSet);
    expect(cacheSetMock).toHaveBeenCalledWith(
      'retail:booking:v1:11-030686',
      expect.any(String),
      90,
    );
  });

  it('returns null when booking code does not exist', async () => {
    const loaded = await getRetailBookingByBookCode('11-999999');
    expect(loaded).toBeNull();
  });

  it('returns null when cached payload is invalid', async () => {
    memory.set('retail:booking:v1:11-030686', '{"bad":true}');
    const loaded = await getRetailBookingByBookCode('11-030686');
    expect(loaded).toBeNull();
  });
});
