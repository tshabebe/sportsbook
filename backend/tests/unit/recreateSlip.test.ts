import { describe, expect, it } from 'vitest';
import {
  normalizeBookCodeRoot,
  rebuildSlipFromStoredLines,
} from '../../src/services/recreateSlip';

describe('recreateSlip', () => {
  it('normalizes root book code from batch ticket ids', () => {
    expect(normalizeBookCodeRoot('11-030686')).toBe('11-030686');
    expect(normalizeBookCodeRoot('11-030686-2')).toBe('11-030686');
    expect(normalizeBookCodeRoot('custom-code')).toBe('custom-code');
  });

  it('rebuilds multiple mode from one stored line', () => {
    const slip = rebuildSlipFromStoredLines([
      {
        stake: '10.00',
        selections: [
          {
            fixtureId: 1001,
            marketBetId: '1',
            value: 'Home',
            odd: '1.80',
            handicap: null,
            bookmakerId: 8,
          },
          {
            fixtureId: 1002,
            marketBetId: '1',
            value: 'Away',
            odd: '2.20',
            handicap: null,
            bookmakerId: 8,
          },
        ],
      },
    ]);

    expect(slip.mode).toBe('multiple');
    expect(slip.stake).toBe(10);
    expect(slip.selections).toHaveLength(2);
  });

  it('rebuilds single mode from one-selection lines', () => {
    const slip = rebuildSlipFromStoredLines([
      {
        stake: '3.34',
        selections: [
          {
            fixtureId: 1001,
            marketBetId: '1',
            value: 'Home',
            odd: '1.80',
            handicap: null,
            bookmakerId: 8,
          },
        ],
      },
      {
        stake: '3.33',
        selections: [
          {
            fixtureId: 1002,
            marketBetId: '1',
            value: 'Away',
            odd: '2.20',
            handicap: null,
            bookmakerId: 8,
          },
        ],
      },
      {
        stake: '3.33',
        selections: [
          {
            fixtureId: 1003,
            marketBetId: '1',
            value: 'Draw',
            odd: '3.10',
            handicap: null,
            bookmakerId: 8,
          },
        ],
      },
    ]);

    expect(slip.mode).toBe('single');
    expect(slip.stake).toBe(10);
    expect(slip.selections).toHaveLength(3);
  });

  it('rebuilds system mode and dedupes repeated selections', () => {
    const slip = rebuildSlipFromStoredLines([
      {
        stake: '5.00',
        selections: [
          {
            fixtureId: 1001,
            marketBetId: '1',
            value: 'Home',
            odd: '1.80',
            handicap: null,
            bookmakerId: 8,
          },
          {
            fixtureId: 1002,
            marketBetId: '1',
            value: 'Away',
            odd: '2.20',
            handicap: null,
            bookmakerId: 8,
          },
        ],
      },
      {
        stake: '5.00',
        selections: [
          {
            fixtureId: 1001,
            marketBetId: '1',
            value: 'Home',
            odd: '1.80',
            handicap: null,
            bookmakerId: 8,
          },
          {
            fixtureId: 1003,
            marketBetId: '1',
            value: 'Draw',
            odd: '3.10',
            handicap: null,
            bookmakerId: 8,
          },
        ],
      },
    ]);

    expect(slip.mode).toBe('system');
    expect(slip.systemSize).toBe(2);
    expect(slip.stake).toBe(10);
    expect(slip.selections).toHaveLength(3);
  });
});
