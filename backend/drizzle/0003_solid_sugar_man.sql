ALTER TABLE "bet_selections" ADD COLUMN "handicap" text;--> statement-breakpoint
CREATE INDEX "bet_selections_fixture_idx" ON "bet_selections" USING btree ("fixture_id");--> statement-breakpoint
CREATE INDEX "bet_selections_bet_idx" ON "bet_selections" USING btree ("bet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bets_bet_ref_idx" ON "bets" USING btree ("bet_ref");--> statement-breakpoint
CREATE INDEX "bets_status_idx" ON "bets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bets_user_id_idx" ON "bets" USING btree ("user_id");