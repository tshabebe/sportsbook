import {
  bigint,
  bigserial,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { bets } from './bets';
import { retailers } from './retailers';

export const retailTicketStatusEnum = [
  'open',
  'claimed',
  'settled_lost',
  'settled_won_unpaid',
  'paid',
  'void',
  'expired',
] as const;

export const retailTickets = pgTable(
  'retail_tickets',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ticketId: text('ticket_id').notNull(),
    channel: text('channel', { enum: ['online_retail_ticket'] as const })
      .default('online_retail_ticket')
      .notNull(),
    status: text('status', { enum: retailTicketStatusEnum }).default('open').notNull(),
    sourceBookCode: text('source_book_code'),
    betId: bigint('bet_id', { mode: 'number' })
      .notNull()
      .references(() => bets.id),
    claimedByRetailerId: bigint('claimed_by_retailer_id', { mode: 'number' }).references(
      () => retailers.id,
    ),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    paidByRetailerId: bigint('paid_by_retailer_id', { mode: 'number' }).references(
      () => retailers.id,
    ),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    payoutAmount: numeric('payout_amount', { precision: 12, scale: 2 }),
    payoutReference: text('payout_reference'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    ticketIdIdx: uniqueIndex('retail_tickets_ticket_id_idx').on(table.ticketId),
    payoutReferenceIdx: uniqueIndex('retail_tickets_payout_reference_idx').on(
      table.payoutReference,
    ),
    statusIdx: index('retail_tickets_status_idx').on(table.status),
    claimedByRetailerIdx: index('retail_tickets_claimed_by_retailer_idx').on(
      table.claimedByRetailerId,
    ),
    sourceBookCodeIdx: index('retail_tickets_source_book_code_idx').on(table.sourceBookCode),
    betIdIdx: index('retail_tickets_bet_id_idx').on(table.betId),
  }),
);

export const retailTicketsInsertSchema = createInsertSchema(retailTickets);
export const retailTicketsSelectSchema = createSelectSchema(retailTickets);
export const retailTicketsUpdateSchema = createUpdateSchema(retailTickets);

export type DbRetailTicketInsert = typeof retailTickets.$inferInsert;
export type DbRetailTicketSelect = typeof retailTickets.$inferSelect;
