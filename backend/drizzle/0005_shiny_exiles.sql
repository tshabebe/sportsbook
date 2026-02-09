CREATE TABLE "retailers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retail_tickets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"channel" text DEFAULT 'online_retail_ticket' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"bet_id" bigint NOT NULL,
	"claimed_by_retailer_id" bigint,
	"claimed_at" timestamp with time zone,
	"paid_by_retailer_id" bigint,
	"paid_at" timestamp with time zone,
	"payout_amount" numeric(12, 2),
	"payout_reference" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retail_ticket_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"event_type" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"payload_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bets" ADD COLUMN "channel" text DEFAULT 'online_wallet' NOT NULL;--> statement-breakpoint
ALTER TABLE "bets" ADD COLUMN "ticket_id" text;--> statement-breakpoint
ALTER TABLE "retail_tickets" ADD CONSTRAINT "retail_tickets_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retail_tickets" ADD CONSTRAINT "retail_tickets_claimed_by_retailer_id_retailers_id_fk" FOREIGN KEY ("claimed_by_retailer_id") REFERENCES "public"."retailers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retail_tickets" ADD CONSTRAINT "retail_tickets_paid_by_retailer_id_retailers_id_fk" FOREIGN KEY ("paid_by_retailer_id") REFERENCES "public"."retailers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "retailers_username_idx" ON "retailers" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "retail_tickets_ticket_id_idx" ON "retail_tickets" USING btree ("ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "retail_tickets_payout_reference_idx" ON "retail_tickets" USING btree ("payout_reference");--> statement-breakpoint
CREATE INDEX "retail_tickets_status_idx" ON "retail_tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "retail_tickets_claimed_by_retailer_idx" ON "retail_tickets" USING btree ("claimed_by_retailer_id");--> statement-breakpoint
CREATE INDEX "retail_tickets_bet_id_idx" ON "retail_tickets" USING btree ("bet_id");--> statement-breakpoint
CREATE INDEX "retail_ticket_events_ticket_id_idx" ON "retail_ticket_events" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "retail_ticket_events_event_type_idx" ON "retail_ticket_events" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "bets_ticket_id_idx" ON "bets" USING btree ("ticket_id");
