import { describe, expect, it } from 'vitest';
import { expandBetSlipLines, totalPotentialPayout } from '../../src/services/betModes';
import type { ApiBetSlipInput } from '../../src/validation/bets';

const selection = (
  fixtureId: number,
  odd: number,
  value = 'Home',
): ApiBetSlipInput['selections'][number] => ({
  fixtureId,
  betId: 1,
  value,
  odd,
  bookmakerId: 8,
});

describe('betModes', () => {
  it('expands multiple mode into one accumulator line', () => {
    const slip: ApiBetSlipInput = {
      mode: 'multiple',
      stake: 100,
      selections: [selection(1, 1.5), selection(2, 3.2), selection(3, 2.1)],
    };

    const lines = expandBetSlipLines(slip);
    expect(lines).toHaveLength(1);
    expect(lines[0].stake).toBe(100);
    expect(lines[0].potentialPayout).toBe(1008);
    expect(totalPotentialPayout(lines)).toBe(1008);
  });

  it('expands single mode into independent lines with split stake', () => {
    const slip: ApiBetSlipInput = {
      mode: 'single',
      stake: 100,
      selections: [selection(1, 1.5), selection(2, 3.2), selection(3, 2.1)],
    };

    const lines = expandBetSlipLines(slip);
    expect(lines).toHaveLength(3);
    expect(lines.map((line) => line.stake)).toEqual([33.34, 33.33, 33.33]);
    expect(lines.map((line) => line.potentialPayout)).toEqual([50.01, 106.66, 69.99]);
    expect(totalPotentialPayout(lines)).toBe(226.66);
  });

  it('expands system mode into all combinations and split stake', () => {
    const slip: ApiBetSlipInput = {
      mode: 'system',
      systemSize: 2,
      stake: 100,
      selections: [selection(1, 1.5), selection(2, 3.2), selection(3, 2.1)],
    };

    const lines = expandBetSlipLines(slip);
    expect(lines).toHaveLength(3);
    expect(lines.map((line) => line.stake)).toEqual([33.34, 33.33, 33.33]);
    expect(lines.map((line) => line.potentialPayout)).toEqual([160.03, 104.99, 223.98]);
    expect(totalPotentialPayout(lines)).toBe(489);
  });
});
