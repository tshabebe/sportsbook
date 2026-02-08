import {
  pgTable,
  bigserial,
  bigint,
  text,
  numeric,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { bets } from './bets';

export const betSelections = pgTable(
  'bet_selections',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    betId: bigint('bet_id', { mode: 'number' })
      .notNull()
      .references(() => bets.id),
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

export const betSelectionsInsertSchema = createInsertSchema(betSelections);
export const betSelectionsSelectSchema = createSelectSchema(betSelections);
export const betSelectionsUpdateSchema = createUpdateSchema(betSelections);

export type DbBetSelectionInsert = typeof betSelections.$inferInsert;
export type DbBetSelectionSelect = typeof betSelections.$inferSelect;
