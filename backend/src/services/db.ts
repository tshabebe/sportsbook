import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  bets,
  betSelections,
  betsSelectSchema,
  betsInsertSchema,
  dbBetSettlementUpdateSchema,
  betSelectionsSelectSchema,
  betSelectionsInsertSchema,
  type DbBetSelect,
  type DbBetSelectionSelect,
} from '../db/schema';
import type { ApiBetSlipInput } from '../validation/bets';

export const createBetWithSelections = async (
  betRef: string,
  slip: ApiBetSlipInput,
  user: { id?: number; username?: string },
  status: string,
  walletDebitTx?: string,
): Promise<number | null> => {
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

type DbBetWithSelections = DbBetSelect & { selections: DbBetSelectionSelect[] };

export const listBetsWithSelections = async () => {
  const betRows = await db.select().from(bets).orderBy(desc(bets.id));
  const selectionRows = await db.select().from(betSelections);
  const selectionsByBet = new Map<number, typeof selectionRows>();
  selectionRows.forEach((row) => {
    const list = selectionsByBet.get(row.betId) ?? [];
    list.push(row);
    selectionsByBet.set(row.betId, list);
  });
  return betRows.map((bet): DbBetWithSelections => {
    const parsedBet = betsSelectSchema.parse(bet);
    const parsedSelections = (selectionsByBet.get(bet.id) ?? []).map((selection) =>
      betSelectionsSelectSchema.parse(selection),
    );
    return { ...parsedBet, selections: parsedSelections };
  });
};

export const getBetWithSelections = async (betId: number) => {
  const [betRow] = await db.select().from(bets).where(eq(bets.id, betId));
  if (!betRow) return null;
  const selections = await db
    .select()
    .from(betSelections)
    .where(eq(betSelections.betId, betId));
  const parsedBet = betsSelectSchema.parse(betRow);
  const parsedSelections = selections.map((selection) =>
    betSelectionsSelectSchema.parse(selection),
  );
  return { ...parsedBet, selections: parsedSelections };
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
  const parsedUpdate = dbBetSettlementUpdateSchema.parse({
    status: updates.status,
    result: updates.result ?? null,
    payout:
      updates.payout !== null && updates.payout !== undefined
        ? updates.payout.toFixed(2)
        : null,
    walletCreditTx: updates.walletCreditTx ?? null,
    settledAt: new Date(),
  });
  const [row] = await db
    .update(bets)
    .set(parsedUpdate)
    .where(eq(bets.id, betId))
    .returning();
  return row ? betsSelectSchema.parse(row) : null;
};

export const listPendingBetsByFixture = async (fixtureId: number) => {
  const rows = await db
    .selectDistinct({ bet: bets })
    .from(bets)
    .innerJoin(betSelections, eq(betSelections.betId, bets.id))
    .where(and(eq(bets.status, 'pending'), eq(betSelections.fixtureId, fixtureId)))
    .orderBy(desc(bets.id));
  return rows.map((row) => betsSelectSchema.parse(row.bet));
};

export const getExposureForOutcome = async (
  fixtureId: number,
  value: string,
  marketBetId?: string | number,
  handicap?: string | number,
  bookmakerId?: number,
): Promise<number> => {
  const conditions = [
    eq(bets.status, 'pending'),
    eq(betSelections.fixtureId, fixtureId),
    eq(betSelections.value, value),
  ];
  if (marketBetId !== undefined) {
    conditions.push(eq(betSelections.marketBetId, String(marketBetId)));
  }
  if (handicap !== undefined) {
    conditions.push(eq(betSelections.handicap, String(handicap)));
  }
  if (bookmakerId !== undefined) {
    conditions.push(eq(betSelections.bookmakerId, bookmakerId));
  }

  const [row] = await db
    .select({
      exposure: sql<string>`coalesce(sum(${bets.stake} * ${betSelections.odd}), 0)`,
    })
    .from(bets)
    .innerJoin(betSelections, eq(betSelections.betId, bets.id))
    .where(and(...conditions));

  const exposure = Number(row?.exposure ?? 0);
  return Number.isNaN(exposure) ? 0 : exposure;
};
