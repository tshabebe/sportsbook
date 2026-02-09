import { bigserial, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';

export const retailTicketEventTypeEnum = [
  'created',
  'claimed',
  'settled_won',
  'settled_lost',
  'paid',
  'voided',
  'expired',
] as const;

export const retailTicketActorTypeEnum = ['system', 'retailer'] as const;

export const retailTicketEvents = pgTable(
  'retail_ticket_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ticketId: text('ticket_id').notNull(),
    eventType: text('event_type', { enum: retailTicketEventTypeEnum }).notNull(),
    actorType: text('actor_type', { enum: retailTicketActorTypeEnum }).notNull(),
    actorId: text('actor_id'),
    payloadJson: jsonb('payload_json'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    ticketIdIdx: index('retail_ticket_events_ticket_id_idx').on(table.ticketId),
    eventTypeIdx: index('retail_ticket_events_event_type_idx').on(table.eventType),
  }),
);

export const retailTicketEventsInsertSchema = createInsertSchema(retailTicketEvents);
export const retailTicketEventsSelectSchema = createSelectSchema(retailTicketEvents);
export const retailTicketEventsUpdateSchema = createUpdateSchema(retailTicketEvents);

export type DbRetailTicketEventInsert = typeof retailTicketEvents.$inferInsert;
export type DbRetailTicketEventSelect = typeof retailTicketEvents.$inferSelect;
