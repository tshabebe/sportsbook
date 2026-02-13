import path from 'path';
import { describe, expect, it } from 'vitest';
import dotenv from 'dotenv';
import { apiFootball } from '../../src/services/apiFootball';
import { isMarketNameSupported } from '../../src/services/settlementResolver';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const shouldRun =
  process.env.RUN_LIVE_TESTS === '1' && Boolean(process.env.API_FOOTBALL_KEY);

describe('odds market catalog coverage live', () => {
  it.runIf(shouldRun)(
    'maps every API-Football pre-match market name to a supported settlement family',
    async () => {
      const payload = await apiFootball.proxy<any[]>('/odds/bets');
      const rows = Array.isArray(payload.response) ? payload.response : [];

      expect(rows.length).toBeGreaterThan(0);

      const unsupported = rows
        .map((row) => ({
          id: String(row?.id ?? row?.bet?.id ?? ''),
          name: String(row?.name ?? row?.bet?.name ?? '').trim(),
        }))
        .filter((row) => row.id && row.name)
        .filter((row) => !isMarketNameSupported(row.name));

      expect(
        unsupported,
        `Unsupported market names: ${unsupported
          .slice(0, 20)
          .map((row) => `${row.id}:${row.name}`)
          .join(' | ')}`,
      ).toEqual([]);
    },
    60000,
  );
});
