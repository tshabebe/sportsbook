import { sql, desc, eq } from 'drizzle-orm';
import { getDb } from '../db/connection';
import {
  bets,
  betSelections,
  betsInsertSchema,
  betSelectionsInsertSchema,
} from '../db/schema';
import type { BetSlipInput } from '../validation/bets';

let schemaEnsured = false;

const ensureSchema = async (): Promise<void> => {
  if (schemaEnsured) return;
  const db = getDb();
  if (!db) return;
  // Note: Odds Snapshots table removed as part of simplification
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bets (
      id BIGSERIAL PRIMARY KEY,
      bet_ref TEXT NOT NULL,
      user_id BIGINT,
      username TEXT,
      stake NUMERIC(12,2) NOT NULL,
      status TEXT NOT NULL,
      wallet_debit_tx TEXT,
      wallet_credit_tx TEXT,
      payout NUMERIC(12,2),
      result TEXT,
      settled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bet_selections (
      id BIGSERIAL PRIMARY KEY,
      bet_id BIGINT NOT NULL,
      fixture_id BIGINT NOT NULL,
      market_bet_id TEXT,
      value TEXT NOT NULL,
      odd NUMERIC(8,3) NOT NULL,
      handicap TEXT,
      bookmaker_id BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.execute(sql`ALTER TABLE bet_selections ADD COLUMN IF NOT EXISTS handicap TEXT;`);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS bets_bet_ref_idx ON bets (bet_ref);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS bets_status_idx ON bets (status);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS bets_user_id_idx ON bets (user_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS bet_selections_fixture_idx ON bet_selections (fixture_id);`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS bet_selections_bet_idx ON bet_selections (bet_id);`);
  schemaEnsured = true;
};

export const createBetWithSelections = async (
  betRef: string,
  slip: BetSlipInput,
  user: { id?: number; username?: string },
  status: string,
  walletDebitTx?: string,
): Promise<number | null> => {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const betRow = betsInsertSchema.parse({
    betRef,
    userId: user.id ?? null,
    username: user.username ?? null,
    stake: slip.stake.toFixed(2),
    status,
    walletDebitTx: walletDebitTx ?? null,
  });
  const [inserted] = await db.insert(bets).values(betRow).returning({ id: bets.id });
  const betId = inserted?.id;
  if (!betId) return null;
  const selectionRows = slip.selections.map((selection) =>
    betSelectionsInsertSchema.parse({
      betId,
      fixtureId: selection.fixtureId,
      marketBetId: selection.betId ? String(selection.betId) : null,
      value: selection.value,
      odd: selection.odd.toFixed(3),
      handicap: selection.handicap !== undefined ? String(selection.handicap) : null,
      bookmakerId: selection.bookmakerId ?? null,
    }),
  );
  await db.insert(betSelections).values(selectionRows);
  return betId;
};

export const listBetsWithSelections = async () => {
  const db = getDb();
  if (!db) return [];
  await ensureSchema();
  const betRows = await db.select().from(bets).orderBy(desc(bets.id));
  const selectionRows = await db.select().from(betSelections);
  const selectionsByBet = new Map<number, typeof selectionRows>();
  selectionRows.forEach((row) => {
    const list = selectionsByBet.get(row.betId) ?? [];
    list.push(row);
    selectionsByBet.set(row.betId, list);
  });
  return betRows.map((bet) => ({
    ...bet,
    selections: selectionsByBet.get(bet.id) ?? [],
  }));
};

export const getBetWithSelections = async (betId: number) => {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const [betRow] = await db.select().from(bets).where(eq(bets.id, betId));
  if (!betRow) return null;
  const selections = await db
    .select()
    .from(betSelections)
    .where(eq(betSelections.betId, betId));
  return { ...betRow, selections };
};

export const updateBetSettlement = async (
  betId: number,
  updates: {
    status: string;
    result?: string | null;
    payout?: number | null;
    walletCreditTx?: string | null;
  },
) => {
  const db = getDb();
  if (!db) return null;
  await ensureSchema();
  const [row] = await db
    .update(bets)
    .set({
      status: updates.status,
      result: updates.result ?? null,
      payout: updates.payout !== null && updates.payout !== undefined ? updates.payout.toFixed(2) : null,
      walletCreditTx: updates.walletCreditTx ?? null,
      settledAt: new Date(),
    })
    .where(eq(bets.id, betId))
    .returning();
  return row ?? null;
};

export const listPendingBetsByFixture = async (fixtureId: number) => {
  const db = getDb();
  if (!db) return [];
  await ensureSchema();
  const rows = await db.execute(sql`
    SELECT b.*
    FROM bets b
    JOIN bet_selections s ON s.bet_id = b.id
    WHERE b.status = 'pending'
      AND s.fixture_id = ${fixtureId}
    ORDER BY b.id DESC
  `);
  return (rows as unknown as { rows: unknown[] }).rows ?? [];
};

export const getExposureForOutcome = async (
  fixtureId: number,
  value: string,
  marketBetId?: string | number,
  handicap?: string | number,
  bookmakerId?: number,
): Promise<number> => {
  const db = getDb();
  if (!db) return 0;
  await ensureSchema();
  const rows = await db.execute(sql`
    SELECT COALESCE(SUM(b.stake * s.odd), 0) AS exposure
    FROM bets b
    JOIN bet_selections s ON s.bet_id = b.id
    WHERE b.status = 'pending'
      AND s.fixture_id = ${fixtureId}
      AND s.value = ${value}
      AND (${marketBetId !== undefined ? sql` s.market_bet_id = ${String(marketBetId)} ` : sql` TRUE `})
      AND (${handicap !== undefined ? sql` s.handicap = ${String(handicap)} ` : sql` TRUE `})
      AND (${bookmakerId !== undefined ? sql` s.bookmaker_id = ${bookmakerId} ` : sql` TRUE `})
  `);
  const first = (rows as unknown as { rows: Array<{ exposure: string | number }> }).rows?.[0];
  const exposure = Number(first?.exposure ?? 0);
  return Number.isNaN(exposure) ? 0 : exposure;
};
