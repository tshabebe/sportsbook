import { describe, expect, it } from 'vitest';
import { generateRetailBookCode } from '../../src/services/bookCode';

describe('generateRetailBookCode', () => {
  it('creates short codes with day prefix', () => {
    const code = generateRetailBookCode(
      new Date('2026-02-11T12:00:00.000Z'),
      () => 0.030686,
    );
    expect(code).toBe('11-030686');
  });

  it('returns the expected format', () => {
    const code = generateRetailBookCode();
    expect(code).toMatch(/^\d{2}-\d{6}$/);
  });
});
