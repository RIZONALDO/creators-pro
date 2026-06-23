-- Simplificação de shift_status: 'pending'/'confirmed' nunca tiveram função real (mesma pessoa
-- cria e "confirma", sem ação de terceiro/notificação/relatório que diferencie os dois) — viram
-- 'scheduled'. 'completed'/'cancelled' ficam (são os únicos com desfecho real, ver specs/06).
ALTER TABLE "shifts" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "shifts" ALTER COLUMN "status" TYPE text;
UPDATE "shifts" SET "status" = 'scheduled' WHERE "status" IN ('pending', 'confirmed');
DROP TYPE "shift_status";
CREATE TYPE "shift_status" AS ENUM ('scheduled', 'completed', 'cancelled');
ALTER TABLE "shifts" ALTER COLUMN "status" TYPE "shift_status" USING "status"::"shift_status";
ALTER TABLE "shifts" ALTER COLUMN "status" SET DEFAULT 'scheduled';
