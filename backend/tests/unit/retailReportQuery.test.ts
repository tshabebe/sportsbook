import { describe, expect, it } from 'vitest';
import { retailReportQuerySchema } from '../../src/validation/retail';

describe('retailReportQuerySchema', () => {
  it('parses ISO date values', () => {
    const parsed = retailReportQuerySchema.safeParse({
      from: '2026-02-01T00:00:00.000Z',
      to: '2026-02-07T23:59:59.999Z',
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.from).toBeInstanceOf(Date);
    expect(parsed.data.to).toBeInstanceOf(Date);
    expect(parsed.data.from?.toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });

  it('parses unix ms date values', () => {
    const from = String(Date.UTC(2026, 1, 1, 0, 0, 0, 0));
    const to = String(Date.UTC(2026, 1, 3, 0, 0, 0, 0));
    const parsed = retailReportQuerySchema.safeParse({ from, to });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.from?.getTime()).toBe(Number(from));
    expect(parsed.data.to?.getTime()).toBe(Number(to));
  });

  it('rejects invalid date values', () => {
    const parsed = retailReportQuerySchema.safeParse({ from: 'not-a-date' });
    expect(parsed.success).toBe(false);
  });

  it('rejects range where from is after to', () => {
    const parsed = retailReportQuerySchema.safeParse({
      from: '2026-02-10T00:00:00.000Z',
      to: '2026-02-01T00:00:00.000Z',
    });
    expect(parsed.success).toBe(false);
  });
});
