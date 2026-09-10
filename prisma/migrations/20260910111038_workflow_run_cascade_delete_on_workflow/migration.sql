-- DropForeignKey
ALTER TABLE "workflow_runs" DROP CONSTRAINT "workflow_runs_workflowId_fkey";

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
