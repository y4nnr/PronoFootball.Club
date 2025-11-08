-- AlterTable
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "externalId" TEXT;

-- AlterTable
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "liveHomeScore" INTEGER;

-- AlterTable
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "liveAwayScore" INTEGER;

-- AlterTable
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "lastSyncAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "externalStatus" TEXT;

-- AlterTable
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "statusDetail" TEXT;

-- AlterTable
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "decidedBy" TEXT;

-- AlterTable
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "finishedAt" TIMESTAMP(3);

