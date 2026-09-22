-- CreateEnum
CREATE TYPE "GrowthStageKey" AS ENUM ('DEFINE_BUSINESS', 'UNDERSTAND_AUDIENCE', 'RESEARCH_MARKET', 'CREATE_OFFER', 'CREATE_CREATIVE_ASSETS', 'BUILD_CAMPAIGN', 'LAUNCH_CAMPAIGN', 'ANALYZE_RESULTS', 'OPTIMIZE', 'SCALE_GROW');

-- CreateEnum
CREATE TYPE "GrowthMissionCadence" AS ENUM ('DAILY', 'WEEKLY');

-- CreateTable
CREATE TABLE "client_growth_progress" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "currentStage" "GrowthStageKey" NOT NULL DEFAULT 'DEFINE_BUSINESS',
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_growth_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_growth_stage_completions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "stage" "GrowthStageKey" NOT NULL,
    "completedBy" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_growth_stage_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_missions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "cadence" "GrowthMissionCadence" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "xpReward" INTEGER NOT NULL,
    "targetCount" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "growth_missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_growth_mission_progress" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "progressCount" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_growth_mission_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_growth_achievements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "achievementKey" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_growth_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_growth_progress_clientId_key" ON "client_growth_progress"("clientId");

-- CreateIndex
CREATE INDEX "client_growth_progress_organizationId_idx" ON "client_growth_progress"("organizationId");

-- CreateIndex
CREATE INDEX "client_growth_stage_completions_organizationId_clientId_idx" ON "client_growth_stage_completions"("organizationId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_growth_stage_completions_clientId_stage_key" ON "client_growth_stage_completions"("clientId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "growth_missions_key_key" ON "growth_missions"("key");

-- CreateIndex
CREATE INDEX "client_growth_mission_progress_organizationId_clientId_idx" ON "client_growth_mission_progress"("organizationId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_growth_mission_progress_clientId_missionId_periodSta_key" ON "client_growth_mission_progress"("clientId", "missionId", "periodStart");

-- CreateIndex
CREATE INDEX "client_growth_achievements_organizationId_clientId_idx" ON "client_growth_achievements"("organizationId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_growth_achievements_clientId_achievementKey_key" ON "client_growth_achievements"("clientId", "achievementKey");

-- AddForeignKey
ALTER TABLE "client_growth_progress" ADD CONSTRAINT "client_growth_progress_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_growth_stage_completions" ADD CONSTRAINT "client_growth_stage_completions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_growth_mission_progress" ADD CONSTRAINT "client_growth_mission_progress_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_growth_mission_progress" ADD CONSTRAINT "client_growth_mission_progress_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "growth_missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_growth_achievements" ADD CONSTRAINT "client_growth_achievements_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

