import { describe, expect, it } from 'vitest';
import { betSlipSchema } from '../../src/validation/bets';

const selection = (fixtureId: number) => ({
  fixtureId,
  betId: 1,
  value: 'Home',
  odd: 2,
  bookmakerId: 8,
});

describe('betSlipSchema mode rules', () => {
  it('requires at least two selections for multiple mode', () => {
    const parsed = betSlipSchema.safeParse({
      mode: 'multiple',
      stake: 10,
      selections: [selection(1)],
    });
    expect(parsed.success).toBe(false);
  });

  it('requires systemSize for system mode', () => {
    const parsed = betSlipSchema.safeParse({
      mode: 'system',
      stake: 10,
      selections: [selection(1), selection(2), selection(3)],
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts valid single mode with one selection', () => {
    const parsed = betSlipSchema.safeParse({
      mode: 'single',
      stake: 10,
      selections: [selection(1)],
    });
    expect(parsed.success).toBe(true);
  });
});
