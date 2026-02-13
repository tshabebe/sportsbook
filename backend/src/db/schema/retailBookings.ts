import {
  bigserial,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';

export const retailBookings = pgTable(
  'retail_bookings',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    bookCode: text('book_code').notNull(),
    slipJson: jsonb('slip_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    bookCodeIdx: uniqueIndex('retail_bookings_book_code_idx').on(table.bookCode),
    createdAtIdx: index('retail_bookings_created_at_idx').on(table.createdAt),
  }),
);

export const retailBookingsInsertSchema = createInsertSchema(retailBookings);
export const retailBookingsSelectSchema = createSelectSchema(retailBookings);
export const retailBookingsUpdateSchema = createUpdateSchema(retailBookings);

export type DbRetailBookingInsert = typeof retailBookings.$inferInsert;
export type DbRetailBookingSelect = typeof retailBookings.$inferSelect;
