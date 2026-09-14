-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "link" TEXT;

-- CreateIndex
CREATE INDEX "notifications_organizationId_userId_readAt_createdAt_idx" ON "notifications"("organizationId", "userId", "readAt", "createdAt");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
