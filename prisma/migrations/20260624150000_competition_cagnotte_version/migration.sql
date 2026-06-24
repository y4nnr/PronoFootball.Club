-- AlterTable
ALTER TABLE "Competition" ADD COLUMN "cagnotteVersion" INTEGER NOT NULL DEFAULT 2;

-- Backfill: every already-COMPLETED competition keeps the legacy percentage display
-- so historical pages don't visually change. ACTIVE/UPCOMING comps (i.e. WC 2026) and
-- any new competition default to the rounded-€50 distribution (v2).
UPDATE "Competition" SET "cagnotteVersion" = 1 WHERE "status" = 'COMPLETED';
