DROP INDEX "transactions_import_key_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_import_key_unique" ON "transactions" USING btree ("user_id","import_key");