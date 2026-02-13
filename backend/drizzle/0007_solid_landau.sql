ALTER TABLE "retail_tickets" ADD COLUMN "source_book_code" text;--> statement-breakpoint
CREATE INDEX "retail_tickets_source_book_code_idx" ON "retail_tickets" USING btree ("source_book_code");