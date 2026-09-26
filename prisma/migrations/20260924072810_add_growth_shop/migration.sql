-- AlterTable
ALTER TABLE "client_growth_progress" ADD COLUMN     "equippedCelebration" TEXT,
ADD COLUMN     "equippedMapTheme" TEXT,
ADD COLUMN     "equippedMascot" TEXT,
ADD COLUMN     "streakShields" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "xpSpent" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "client_growth_purchases" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "xpCost" INTEGER NOT NULL,
    "purchasedBy" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_growth_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_growth_purchases_organizationId_clientId_idx" ON "client_growth_purchases"("organizationId", "clientId");

-- CreateIndex
CREATE INDEX "client_growth_purchases_clientId_itemKey_idx" ON "client_growth_purchases"("clientId", "itemKey");

-- AddForeignKey
ALTER TABLE "client_growth_purchases" ADD CONSTRAINT "client_growth_purchases_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
