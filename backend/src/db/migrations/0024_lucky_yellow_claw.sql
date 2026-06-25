CREATE TABLE IF NOT EXISTS "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"stripe_product_id" text,
	"stripe_price_id" text,
	"billing_type" varchar(20) DEFAULT 'monthly' NOT NULL,
	"price_cents" integer NOT NULL,
	"currency" varchar(10) DEFAULT 'brl' NOT NULL,
	"max_gestores" integer,
	"max_creators" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "plan_id" uuid;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "plan_override" jsonb;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "lifetime" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "superadmins" ADD COLUMN "totp_secret" text;