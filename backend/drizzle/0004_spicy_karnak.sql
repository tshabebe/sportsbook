ALTER TABLE "odds_snapshots" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "odds_snapshots" CASCADE;--> statement-breakpoint
ALTER TABLE "bet_selections" ADD CONSTRAINT "bet_selections_bet_id_bets_id_fk" FOREIGN KEY ("bet_id") REFERENCES "public"."bets"("id") ON DELETE no action ON UPDATE no action;