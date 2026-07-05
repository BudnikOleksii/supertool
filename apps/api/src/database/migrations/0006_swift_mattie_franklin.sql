CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX "transactions_note_trgm_idx" ON "transactions" USING gin ("note" gin_trgm_ops);