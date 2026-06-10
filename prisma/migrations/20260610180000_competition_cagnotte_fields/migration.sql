-- AlterTable
ALTER TABLE "Competition" ADD COLUMN "entryFee" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "Competition" ADD COLUMN "prizePctFirst" INTEGER;
ALTER TABLE "Competition" ADD COLUMN "prizePctSecond" INTEGER;
ALTER TABLE "Competition" ADD COLUMN "prizePctThird" INTEGER;
