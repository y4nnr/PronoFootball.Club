-- AlterTable
ALTER TABLE "Competition" ADD COLUMN "finalWinnerEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Competition" ADD COLUMN "finalWinnerLockAt" TIMESTAMP(3);
