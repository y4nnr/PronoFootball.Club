-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- Seed: default to FINAL_ONLY (free-tier safe)
INSERT INTO "AppSetting" ("key", "value", "updatedAt") VALUES ('liveScoreMode', 'FINAL_ONLY', NOW());
