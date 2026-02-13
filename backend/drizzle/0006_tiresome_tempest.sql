CREATE TABLE "retail_bookings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"book_code" text NOT NULL,
	"slip_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "retail_ticket_events" DROP CONSTRAINT IF EXISTS "retail_ticket_events_ticket_id_retail_tickets_ticket_id_fk";
--> statement-breakpoint
CREATE UNIQUE INDEX "retail_bookings_book_code_idx" ON "retail_bookings" USING btree ("book_code");--> statement-breakpoint
CREATE INDEX "retail_bookings_created_at_idx" ON "retail_bookings" USING btree ("created_at");
