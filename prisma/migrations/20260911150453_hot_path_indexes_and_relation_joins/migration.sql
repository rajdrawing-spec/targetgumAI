-- CreateIndex
CREATE INDEX "ai_runs_clientId_createdAt_idx" ON "ai_runs"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "approvals_organizationId_clientId_status_idx" ON "approvals"("organizationId", "clientId", "status");

-- CreateIndex
CREATE INDEX "approvals_organizationId_status_idx" ON "approvals"("organizationId", "status");

-- CreateIndex
CREATE INDEX "content_calendar_organizationId_clientId_publishDate_idx" ON "content_calendar"("organizationId", "clientId", "publishDate");

-- CreateIndex
CREATE INDEX "creative_assets_organizationId_clientId_status_idx" ON "creative_assets"("organizationId", "clientId", "status");

-- CreateIndex
CREATE INDEX "integration_connections_organizationId_clientId_idx" ON "integration_connections"("organizationId", "clientId");

-- CreateIndex
CREATE INDEX "integration_connections_organizationId_status_idx" ON "integration_connections"("organizationId", "status");

-- CreateIndex
CREATE INDEX "recommendations_organizationId_clientId_status_idx" ON "recommendations"("organizationId", "clientId", "status");

-- CreateIndex
CREATE INDEX "recommendations_organizationId_status_priority_idx" ON "recommendations"("organizationId", "status", "priority");

-- CreateIndex
CREATE INDEX "reports_organizationId_clientId_createdAt_idx" ON "reports"("organizationId", "clientId", "createdAt");

-- CreateIndex
CREATE INDEX "tasks_organizationId_clientId_status_idx" ON "tasks"("organizationId", "clientId", "status");
