-- Collaborators agora são profissionais externos sem login no sistema.
-- Remove o vínculo com users e adiciona name/email/phone diretamente na tabela.
CREATE TABLE IF NOT EXISTS "professions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professions_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "professions_tenant_idx" ON "professions" USING btree ("tenant_id");
--> statement-breakpoint
ALTER TABLE "collaborators" ADD COLUMN "name" varchar(255);
--> statement-breakpoint
ALTER TABLE "collaborators" ADD COLUMN "email" varchar(255);
--> statement-breakpoint
ALTER TABLE "collaborators" ADD COLUMN "phone" varchar(50);
--> statement-breakpoint
UPDATE "collaborators" c SET "name" = u.name, "email" = u.email, "phone" = u.phone FROM "users" u WHERE c.user_id = u.id;
--> statement-breakpoint
ALTER TABLE "collaborators" ALTER COLUMN "name" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "collaborators" DROP CONSTRAINT IF EXISTS "collaborators_user_id_unique";
--> statement-breakpoint
ALTER TABLE "collaborators" DROP COLUMN IF EXISTS "user_id";
