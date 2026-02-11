import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
import { formatFixtureTime } from './date';

describe('formatFixtureTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-11T12:00:00.000Z'));
    vi.spyOn(dayjs.tz, 'guess').mockReturnValue('UTC');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns natural minute phrasing for near-future kickoff', () => {
    expect(formatFixtureTime('2026-02-11T12:45:00.000Z')).toBe('Starts in 45 minutes');
  });

  it('returns natural hour phrasing for same-day kickoff', () => {
    expect(formatFixtureTime('2026-02-11T14:00:00.000Z')).toBe('Starts in 2 hours');
  });

  it('returns tomorrow label for next-day kickoff', () => {
    expect(formatFixtureTime('2026-02-12T14:00:00.000Z')).toBe('Tomorrow 14:00');
  });
});
