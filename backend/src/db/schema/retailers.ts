import { boolean, bigserial, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';

export const retailers = pgTable(
  'retailers',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    name: text('name').notNull(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    usernameIdx: uniqueIndex('retailers_username_idx').on(table.username),
  }),
);

export const retailersInsertSchema = createInsertSchema(retailers);
export const retailersSelectSchema = createSelectSchema(retailers);
export const retailersUpdateSchema = createUpdateSchema(retailers);

export type DbRetailerInsert = typeof retailers.$inferInsert;
export type DbRetailerSelect = typeof retailers.$inferSelect;

