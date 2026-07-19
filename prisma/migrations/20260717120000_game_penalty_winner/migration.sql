-- AlterTable
ALTER TABLE "Game" ADD COLUMN "penaltyWinnerTeamId" TEXT;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_penaltyWinnerTeamId_fkey" FOREIGN KEY ("penaltyWinnerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
