CREATE TABLE IF NOT EXISTS "shift_standbys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shift_standbys_shift_creator" UNIQUE("shift_id","creator_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift_standbys" ADD CONSTRAINT "shift_standbys_tenant_id_companies_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift_standbys" ADD CONSTRAINT "shift_standbys_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shift_standbys" ADD CONSTRAINT "shift_standbys_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_standbys_tenant_shift_idx" ON "shift_standbys" USING btree ("tenant_id","shift_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shift_standbys_tenant_creator_idx" ON "shift_standbys" USING btree ("tenant_id","creator_id");