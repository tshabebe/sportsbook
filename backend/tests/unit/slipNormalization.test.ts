import { describe, expect, it } from 'vitest';
import { normalizeSlipForSelections } from '../../src/services/slipNormalization';
import type { ApiBetSlipInput } from '../../src/validation/bets';

const selection = (fixtureId: number, odd: number) => ({
  fixtureId,
  betId: 1,
  value: 'Home',
  odd,
  bookmakerId: 8,
});

const baseSlip = (mode: ApiBetSlipInput['mode']): ApiBetSlipInput => ({
  mode,
  stake: 10,
  selections: [selection(1, 2.1), selection(2, 1.8)],
});

describe('normalizeSlipForSelections', () => {
  it('degrades multiple to single when one valid selection remains', () => {
    const normalized = normalizeSlipForSelections(baseSlip('multiple'), [selection(2, 1.8)]);
    expect(normalized).toBeTruthy();
    expect(normalized?.mode).toBe('single');
    expect(normalized?.selections).toHaveLength(1);
    expect(normalized?.systemSize).toBeUndefined();
  });

  it('degrades system to multiple when two selections remain', () => {
    const slip: ApiBetSlipInput = {
      mode: 'system',
      stake: 10,
      systemSize: 3,
      selections: [selection(1, 2.1), selection(2, 1.8), selection(3, 2.4)],
    };

    const normalized = normalizeSlipForSelections(slip, [selection(1, 2.1), selection(3, 2.4)]);
    expect(normalized).toBeTruthy();
    expect(normalized?.mode).toBe('multiple');
    expect(normalized?.systemSize).toBeUndefined();
  });

  it('keeps system and clamps systemSize when enough selections remain', () => {
    const slip: ApiBetSlipInput = {
      mode: 'system',
      stake: 10,
      systemSize: 6,
      selections: [selection(1, 2.1), selection(2, 1.8), selection(3, 2.4), selection(4, 1.6)],
    };

    const normalized = normalizeSlipForSelections(slip, [selection(1, 2.1), selection(2, 1.8), selection(4, 1.6)]);
    expect(normalized).toBeTruthy();
    expect(normalized?.mode).toBe('system');
    expect(normalized?.systemSize).toBe(3);
  });

  it('returns null when all selections are removed', () => {
    const normalized = normalizeSlipForSelections(baseSlip('multiple'), []);
    expect(normalized).toBeNull();
  });
});
