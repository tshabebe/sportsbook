import { describe, expect, it } from 'vitest';
import { calculateBetSlipPreview } from './betslip';

describe('calculateBetSlipPreview', () => {
  it('splits single mode stake across selections', () => {
    const preview = calculateBetSlipPreview({
      mode: 'single',
      stake: 100,
      selections: [{ odd: 1.5 }, { odd: 3.2 }, { odd: 2.1 }],
    });

    expect(preview.lines.map((line) => line.stake)).toEqual([33.34, 33.33, 33.33]);
    expect(preview.totalPotentialReturn).toBe(226.66);
  });

  it('calculates accumulator odds for multiple mode', () => {
    const preview = calculateBetSlipPreview({
      mode: 'multiple',
      stake: 50,
      selections: [{ odd: 1.7 }, { odd: 1.6 }, { odd: 2 }],
    });

    expect(preview.error).toBeNull();
    expect(preview.lineCount).toBe(1);
    expect(preview.totalPotentialReturn).toBe(272);
  });

  it('builds all combinations for system mode', () => {
    const preview = calculateBetSlipPreview({
      mode: 'system',
      stake: 100,
      systemSize: 2,
      selections: [{ odd: 1.5 }, { odd: 3.2 }, { odd: 2.1 }],
    });

    expect(preview.lineCount).toBe(3);
    expect(preview.totalPotentialReturn).toBe(489);
  });

  it('returns an error when system mode is invalid', () => {
    const preview = calculateBetSlipPreview({
      mode: 'system',
      stake: 100,
      systemSize: 5,
      selections: [{ odd: 1.5 }, { odd: 3.2 }, { odd: 2.1 }],
    });

    expect(preview.error).toBe('Invalid system configuration');
    expect(preview.totalPotentialReturn).toBe(0);
  });
});
