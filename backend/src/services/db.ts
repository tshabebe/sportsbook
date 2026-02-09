import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  bets,
  betsSelectSchema,
  betsInsertSchema,
  dbBetSettlementUpdateSchema,
  type DbBetSelect,
} from '../db/schema/bets';
import {
  betSelections,
  betSelectionsSelectSchema,
  betSelectionsInsertSchema,
  type DbBetSelectionSelect,
} from '../db/schema/betSelections';
import {
  type DbRetailerSelect,
} from '../db/schema/retailers';
import {
  type DbRetailTicketSelect,
} from '../db/schema/retailTickets';
import type { DbRetailTicketEventInsert } from '../db/schema/retailTicketEvents';
import type { ApiBetSlipInput } from '../validation/bets';

export const createBetWithSelections = async (
  betRef: string,
  slip: ApiBetSlipInput,
  user: { id?: number; username?: string },
  status: string,
  walletDebitTx?: string,
  options?: { channel?: 'online_wallet' | 'online_retail_ticket'; ticketId?: string | null },
): Promise<number | null> => {
  const betRow = betsInsertSchema.parse({
    betRef,
    userId: user.id ?? null,
    username: user.username ?? null,
    channel: options?.channel ?? 'online_wallet',
    ticketId: options?.ticketId ?? null,
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
type DbRetailTicketWithBet = DbRetailTicketSelect & { bet: DbBetWithSelections };
type RetailersModule = typeof import('../db/schema/retailers');
type RetailTicketsModule = typeof import('../db/schema/retailTickets');
type RetailTicketEventsModule = typeof import('../db/schema/retailTicketEvents');

const getRetailSchema = (): {
  retailers: RetailersModule['retailers'];
  retailersSelectSchema: RetailersModule['retailersSelectSchema'];
  retailTickets: RetailTicketsModule['retailTickets'];
  retailTicketsInsertSchema: RetailTicketsModule['retailTicketsInsertSchema'];
  retailTicketsSelectSchema: RetailTicketsModule['retailTicketsSelectSchema'];
  retailTicketsUpdateSchema: RetailTicketsModule['retailTicketsUpdateSchema'];
  retailTicketEvents: RetailTicketEventsModule['retailTicketEvents'];
  retailTicketEventsInsertSchema: RetailTicketEventsModule['retailTicketEventsInsertSchema'];
} => {
  const retailersModule = require('../db/schema/retailers') as RetailersModule;
  const retailTicketsModule = require('../db/schema/retailTickets') as RetailTicketsModule;
  const retailTicketEventsModule = require('../db/schema/retailTicketEvents') as RetailTicketEventsModule;

  return {
    retailers: retailersModule.retailers,
    retailersSelectSchema: retailersModule.retailersSelectSchema,
    retailTickets: retailTicketsModule.retailTickets,
    retailTicketsInsertSchema: retailTicketsModule.retailTicketsInsertSchema,
    retailTicketsSelectSchema: retailTicketsModule.retailTicketsSelectSchema,
    retailTicketsUpdateSchema: retailTicketsModule.retailTicketsUpdateSchema,
    retailTicketEvents: retailTicketEventsModule.retailTicketEvents,
    retailTicketEventsInsertSchema: retailTicketEventsModule.retailTicketEventsInsertSchema,
  };
};

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

const appendRetailTicketEvent = async (input: {
  ticketId: string;
  eventType:
    | 'created'
    | 'claimed'
    | 'settled_won'
    | 'settled_lost'
    | 'paid'
    | 'voided'
    | 'expired';
  actorType: 'system' | 'retailer';
  actorId?: string | null;
  payloadJson?: unknown;
}) => {
  const { retailTicketEventsInsertSchema, retailTicketEvents } = getRetailSchema();
  const eventRow: DbRetailTicketEventInsert = retailTicketEventsInsertSchema.parse({
    ticketId: input.ticketId,
    eventType: input.eventType,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    payloadJson: input.payloadJson ?? null,
  });
  await db.insert(retailTicketEvents).values(eventRow);
};

export const findRetailerByUsername = async (
  username: string,
): Promise<DbRetailerSelect | null> => {
  const { retailers, retailersSelectSchema } = getRetailSchema();
  const [row] = await db
    .select()
    .from(retailers)
    .where(eq(retailers.username, username))
    .limit(1);
  if (!row) return null;
  return retailersSelectSchema.parse(row);
};

export const createRetailTicketForBet = async (input: {
  ticketId: string;
  betId: number;
  expiresAt?: Date | null;
}) => {
  const { retailTickets, retailTicketsInsertSchema, retailTicketsSelectSchema } = getRetailSchema();
  const ticketRow = retailTicketsInsertSchema.parse({
    ticketId: input.ticketId,
    betId: input.betId,
    status: 'open',
    expiresAt: input.expiresAt ?? null,
  });
  const [inserted] = await db.insert(retailTickets).values(ticketRow).returning();
  const parsed = retailTicketsSelectSchema.parse(inserted);
  await appendRetailTicketEvent({
    ticketId: parsed.ticketId,
    eventType: 'created',
    actorType: 'system',
    payloadJson: { betId: parsed.betId },
  });
  return parsed;
};

export const getRetailTicketByTicketId = async (
  ticketId: string,
): Promise<DbRetailTicketWithBet | null> => {
  const { retailTickets, retailTicketsSelectSchema } = getRetailSchema();
  const [ticket] = await db
    .select()
    .from(retailTickets)
    .where(eq(retailTickets.ticketId, ticketId))
    .limit(1);

  if (!ticket) return null;
  const parsedTicket = retailTicketsSelectSchema.parse(ticket);
  const bet = await getBetWithSelections(parsedTicket.betId);
  if (!bet) return null;
  return { ...parsedTicket, bet };
};

export const claimRetailTicket = async (ticketId: string, retailerId: number) => {
  const { retailTickets, retailTicketsUpdateSchema, retailTicketsSelectSchema } = getRetailSchema();
  const [updated] = await db
    .update(retailTickets)
    .set(
      retailTicketsUpdateSchema.parse({
        status: 'claimed',
        claimedByRetailerId: retailerId,
        claimedAt: new Date(),
      }),
    )
    .where(
      and(
        eq(retailTickets.ticketId, ticketId),
        eq(retailTickets.status, 'open'),
        sql`${retailTickets.claimedByRetailerId} is null`,
      ),
    )
    .returning();

  if (!updated) return null;
  const parsed = retailTicketsSelectSchema.parse(updated);
  await appendRetailTicketEvent({
    ticketId: parsed.ticketId,
    eventType: 'claimed',
    actorType: 'retailer',
    actorId: String(retailerId),
  });
  return parsed;
};

export const listRetailTicketsByRetailer = async (
  retailerId: number,
  status?:
    | 'open'
    | 'claimed'
    | 'settled_lost'
    | 'settled_won_unpaid'
    | 'paid'
    | 'void'
    | 'expired',
) => {
  const { retailTickets, retailTicketsSelectSchema } = getRetailSchema();
  const rows = await db
    .select()
    .from(retailTickets)
    .where(
      and(
        eq(retailTickets.claimedByRetailerId, retailerId),
        status ? eq(retailTickets.status, status) : sql`true`,
      ),
    )
    .orderBy(desc(retailTickets.id));
  return rows.map((row) => retailTicketsSelectSchema.parse(row));
};

export const payoutRetailTicket = async (input: {
  ticketId: string;
  retailerId: number;
  payoutReference: string;
}) => {
  const { retailTickets, retailTicketsUpdateSchema, retailTicketsSelectSchema } = getRetailSchema();
  const existing = await getRetailTicketByTicketId(input.ticketId);
  if (!existing) return { code: 'NOT_FOUND' as const };
  if (existing.status === 'paid') {
    return { code: 'ALREADY_PAID' as const, ticket: existing };
  }
  if (existing.status !== 'settled_won_unpaid') {
    return { code: 'NOT_SETTLED_FOR_PAYOUT' as const };
  }
  if (existing.claimedByRetailerId !== input.retailerId) {
    return { code: 'NOT_OWNER' as const };
  }

  const [updated] = await db
    .update(retailTickets)
    .set(
      retailTicketsUpdateSchema.parse({
        status: 'paid',
        payoutReference: input.payoutReference,
        paidByRetailerId: input.retailerId,
        paidAt: new Date(),
      }),
    )
    .where(
      and(
        eq(retailTickets.ticketId, input.ticketId),
        eq(retailTickets.status, 'settled_won_unpaid'),
        eq(retailTickets.claimedByRetailerId, input.retailerId),
      ),
    )
    .returning();

  if (!updated) {
    return { code: 'CONFLICT' as const };
  }

  const parsed = retailTicketsSelectSchema.parse(updated);
  await appendRetailTicketEvent({
    ticketId: parsed.ticketId,
    eventType: 'paid',
    actorType: 'retailer',
    actorId: String(input.retailerId),
    payloadJson: { payoutReference: input.payoutReference },
  });
  return { code: 'OK' as const, ticket: parsed };
};

export const settleRetailTicketByBet = async (input: {
  betId: number;
  result: 'won' | 'lost' | 'void';
  payout?: number | null;
}) => {
  const { retailTickets, retailTicketsUpdateSchema, retailTicketsSelectSchema } = getRetailSchema();
  const [ticketRow] = await db
    .select()
    .from(retailTickets)
    .where(eq(retailTickets.betId, input.betId))
    .limit(1);
  if (!ticketRow) return null;

  const ticket = retailTicketsSelectSchema.parse(ticketRow);
  if (input.result === 'won') {
    const [updated] = await db
      .update(retailTickets)
      .set(
        retailTicketsUpdateSchema.parse({
          status: 'settled_won_unpaid',
          payoutAmount:
            input.payout !== undefined && input.payout !== null
              ? input.payout.toFixed(2)
              : null,
        }),
      )
      .where(eq(retailTickets.ticketId, ticket.ticketId))
      .returning();
    if (updated) {
      await appendRetailTicketEvent({
        ticketId: ticket.ticketId,
        eventType: 'settled_won',
        actorType: 'system',
      });
      return retailTicketsSelectSchema.parse(updated);
    }
  }

  if (input.result === 'lost') {
    const [updated] = await db
      .update(retailTickets)
      .set(
        retailTicketsUpdateSchema.parse({
          status: 'settled_lost',
        }),
      )
      .where(eq(retailTickets.ticketId, ticket.ticketId))
      .returning();
    if (updated) {
      await appendRetailTicketEvent({
        ticketId: ticket.ticketId,
        eventType: 'settled_lost',
        actorType: 'system',
      });
      return retailTicketsSelectSchema.parse(updated);
    }
  }

  if (input.result === 'void') {
    const [updated] = await db
      .update(retailTickets)
      .set(
        retailTicketsUpdateSchema.parse({
          status: 'void',
        }),
      )
      .where(eq(retailTickets.ticketId, ticket.ticketId))
      .returning();
    if (updated) {
      await appendRetailTicketEvent({
        ticketId: ticket.ticketId,
        eventType: 'voided',
        actorType: 'system',
      });
      return retailTicketsSelectSchema.parse(updated);
    }
  }

  return ticket;
};
