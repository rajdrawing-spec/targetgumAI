-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "IntegrationProvider" ADD VALUE 'WEB';
ALTER TYPE "IntegrationProvider" ADD VALUE 'BLOG';
ALTER TYPE "IntegrationProvider" ADD VALUE 'FACEBOOK';
ALTER TYPE "IntegrationProvider" ADD VALUE 'INSTAGRAM';
ALTER TYPE "IntegrationProvider" ADD VALUE 'THREADS';
ALTER TYPE "IntegrationProvider" ADD VALUE 'TWITTER_X';
ALTER TYPE "IntegrationProvider" ADD VALUE 'BLUESKY';
ALTER TYPE "IntegrationProvider" ADD VALUE 'PINTEREST';
ALTER TYPE "IntegrationProvider" ADD VALUE 'TIKTOK_PERSONAL';
ALTER TYPE "IntegrationProvider" ADD VALUE 'TIKTOK_BUSINESS';
ALTER TYPE "IntegrationProvider" ADD VALUE 'GOOGLE_BUSINESS_PROFILE';
