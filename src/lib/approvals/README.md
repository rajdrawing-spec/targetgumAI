# approvals

The Approval Engine (BRD-PRD Section 21-22) — `approvals.ts`:
`createApproval`, `listApprovals`, `getApproval`, `approveApproval`, `rejectApproval`,
`cancelApproval`, `markApprovalExecuted`/`markApprovalFailed`.

`approvals.approve` (Account Manager+, per BRD Section 4.2) gates approve/reject;
`approvals.request` (Account Manager + Marketing Employee, Section 4.2-4.3) gates
read/list/cancel-own. Every function is tenant-scoped via `assertClientAccess`, same
as everywhere else.

This is what `src/lib/tools/execute.ts` calls into for every HIGH/CRITICAL-risk tool
call (BRD Section 21) — replacing the Day 5 hard block. See
`executeApprovedTool` there for how an approved request actually gets run, and
docs/DECISIONS.md for why.
