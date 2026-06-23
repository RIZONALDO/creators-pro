ALTER TABLE "creator_tasks" DROP CONSTRAINT "creator_tasks_creator_id_creators_id_fk";
--> statement-breakpoint
ALTER TABLE "collaborator_services" DROP CONSTRAINT "collaborator_services_collaborator_id_collaborators_id_fk";
--> statement-breakpoint
ALTER TABLE "scale_entries" DROP CONSTRAINT "scale_entries_creator_id_creators_id_fk";
--> statement-breakpoint
ALTER TABLE "absences" DROP CONSTRAINT "absences_creator_id_creators_id_fk";
--> statement-breakpoint
ALTER TABLE "shifts" DROP CONSTRAINT "shifts_creator_id_creators_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "creator_tasks" ADD CONSTRAINT "creator_tasks_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "collaborator_services" ADD CONSTRAINT "collaborator_services_collaborator_id_collaborators_id_fk" FOREIGN KEY ("collaborator_id") REFERENCES "public"."collaborators"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scale_entries" ADD CONSTRAINT "scale_entries_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "absences" ADD CONSTRAINT "absences_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shifts" ADD CONSTRAINT "shifts_creator_id_creators_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."creators"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
