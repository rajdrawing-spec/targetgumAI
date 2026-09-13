-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "clientIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clientId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitations_tokenHash_key" ON "invitations"("tokenHash");

-- CreateIndex
CREATE INDEX "invitations_organizationId_status_idx" ON "invitations"("organizationId", "status");

-- CreateIndex
CREATE INDEX "invitations_email_status_idx" ON "invitations"("email", "status");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Role model simplification (docs/DECISIONS.md, 2026-09-13): collapse the
-- four seeded roles (super_admin, account_manager, marketing_employee,
-- client_user) into three (super_admin, employee, client). This is a data
-- migration, not a schema change - Role.key is a plain string column, not a
-- DB enum. Every step is per-organization and safe to run even where an org
-- never had an "account_manager" role at all (the seed script never
-- created one).

-- 1. marketing_employee becomes employee in place - same row, new key/name,
--    so any RolePermission grants and OrganizationUser memberships already
--    pointing at it carry over automatically.
UPDATE "roles" SET "key" = 'employee', "name" = 'Employee' WHERE "key" = 'marketing_employee';

-- 2. Where an org also had a separate account_manager role, fold its
--    permission grants into that same org's (now-renamed) employee role...
INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT "employee"."id", "rp"."permissionId"
FROM "role_permissions" "rp"
JOIN "roles" "account_manager" ON "account_manager"."id" = "rp"."roleId" AND "account_manager"."key" = 'account_manager'
JOIN "roles" "employee" ON "employee"."organizationId" = "account_manager"."organizationId" AND "employee"."key" = 'employee'
ON CONFLICT DO NOTHING;

-- ...move any members who held account_manager onto employee...
UPDATE "organization_users" "ou"
SET "roleId" = "employee"."id"
FROM "roles" "account_manager"
JOIN "roles" "employee" ON "employee"."organizationId" = "account_manager"."organizationId" AND "employee"."key" = 'employee'
WHERE "account_manager"."key" = 'account_manager' AND "ou"."roleId" = "account_manager"."id";

-- ...and, since RolePermission cascades on Role delete, remove the
-- now-unreferenced account_manager role rows entirely.
DELETE FROM "roles" WHERE "key" = 'account_manager';

-- 3. client_user becomes client in place, same reasoning as step 1.
UPDATE "roles" SET "key" = 'client', "name" = 'Client' WHERE "key" = 'client_user';
