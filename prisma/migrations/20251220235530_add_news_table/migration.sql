-- CreateTable
CREATE TABLE "News" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "matchDayDate" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "News_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "News_competitionId_matchDayDate_key" ON "News"("competitionId", "matchDayDate");

-- CreateIndex
CREATE INDEX "News_competitionId_matchDayDate_idx" ON "News"("competitionId", "matchDayDate");

-- AddForeignKey
ALTER TABLE "News" ADD CONSTRAINT "News_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
