ALTER TABLE "bets" ADD COLUMN "payout" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "bets" ADD COLUMN "result" text;--> statement-breakpoint
ALTER TABLE "bets" ADD COLUMN "settled_at" timestamp with time zone;