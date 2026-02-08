import {
  pgTable,
  bigserial,
  text,
  timestamp,
  numeric,
  bigint,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';

export const bets = pgTable(
  'bets',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    betRef: text('bet_ref').notNull(),
    userId: bigint('user_id', { mode: 'number' }),
    username: text('username'),
    stake: numeric('stake', { precision: 12, scale: 2 }).notNull(),
    status: text('status').notNull(),
    walletDebitTx: text('wallet_debit_tx'),
    walletCreditTx: text('wallet_credit_tx'),
    payout: numeric('payout', { precision: 12, scale: 2 }),
    result: text('result'),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    betRefIdx: uniqueIndex('bets_bet_ref_idx').on(table.betRef),
    statusIdx: index('bets_status_idx').on(table.status),
    userIdIdx: index('bets_user_id_idx').on(table.userId),
  }),
);

export const betsInsertSchema = createInsertSchema(bets);
export const betsSelectSchema = createSelectSchema(bets);
export const betsUpdateSchema = createUpdateSchema(bets);

export const dbBetSettlementUpdateSchema = betsUpdateSchema.pick({
  status: true,
  result: true,
  payout: true,
  walletCreditTx: true,
  settledAt: true,
});

export type DbBetInsert = typeof bets.$inferInsert;
export type DbBetSelect = typeof bets.$inferSelect;
