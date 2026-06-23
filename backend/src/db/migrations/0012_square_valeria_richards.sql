ALTER TABLE "companies" ADD COLUMN "stripe_customer_id" varchar(255);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "stripe_subscription_id" varchar(255);--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_stripe_customer_id_unique" UNIQUE("stripe_customer_id");