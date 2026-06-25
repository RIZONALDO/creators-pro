ALTER TYPE "company_status" ADD VALUE 'trial';--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "trial_ends_at" timestamp with time zone;