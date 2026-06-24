ALTER TABLE "users" ADD COLUMN "invite_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_invite_token_hash_unique" UNIQUE("invite_token_hash");