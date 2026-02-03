import {
  pgTable,
  bigserial,
  jsonb,
  text,
  timestamp,
  numeric,
  bigint,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

export const oddsSnapshots = pgTable('odds_snapshots', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  source: text('source').notNull(),
  capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow().notNull(),
  payload: jsonb('payload').notNull(),
});

export const oddsSnapshotsInsertSchema = createInsertSchema(oddsSnapshots);

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

export const betSelections = pgTable(
  'bet_selections',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    betId: bigint('bet_id', { mode: 'number' }).notNull(),
    fixtureId: bigint('fixture_id', { mode: 'number' }).notNull(),
    marketBetId: text('market_bet_id'),
    value: text('value').notNull(),
    odd: numeric('odd', { precision: 8, scale: 3 }).notNull(),
    handicap: text('handicap'),
    bookmakerId: bigint('bookmaker_id', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    fixtureIdx: index('bet_selections_fixture_idx').on(table.fixtureId),
    betIdx: index('bet_selections_bet_idx').on(table.betId),
  }),
);

export const betsInsertSchema = createInsertSchema(bets);
export const betSelectionsInsertSchema = createInsertSchema(betSelections);
