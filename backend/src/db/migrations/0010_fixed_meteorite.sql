CREATE TABLE IF NOT EXISTS "company_settings" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"display_name" varchar(255),
	"logo_url" text,
	"timezone" varchar(50) DEFAULT 'America/Sao_Paulo' NOT NULL,
	"locale" varchar(10) DEFAULT 'pt-BR' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
