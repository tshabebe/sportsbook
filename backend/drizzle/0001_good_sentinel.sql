CREATE TABLE "bet_selections" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bet_id" bigint NOT NULL,
	"fixture_id" bigint NOT NULL,
	"market_bet_id" text,
	"value" text NOT NULL,
	"odd" numeric(8, 3) NOT NULL,
	"bookmaker_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bet_ref" text NOT NULL,
	"user_id" bigint,
	"username" text,
	"stake" numeric(12, 2) NOT NULL,
	"status" text NOT NULL,
	"wallet_debit_tx" text,
	"wallet_credit_tx" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
