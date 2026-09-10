# approvals

The Approval Engine (BRD-PRD Section 21-22) — `approvals.ts`:
`createApproval`, `listApprovals`, `getApproval`, `approveApproval`, `rejectApproval`,
`cancelApproval`, `markApprovalExecuted`/`markApprovalFailed`.

`approvals.approve` (Account Manager+, per BRD Section 4.2) gates approve/reject;
`approvals.request` (Account Manager + Marketing Employee, Section 4.2-4.3) gates
read/list/cancel-own. Every function is tenant-scoped via `assertClientAccess`, same
as everywhere else. Neither permission is held by `client_user` - the formal
Approval Engine (HIGH/CRITICAL tool-execution gating) stays staff-only. A client
reviewing/accepting a *recommendation* (a different, lighter-weight thing - BRD
Section 4.4) goes through `recommendations.review` instead
(`src/lib/recommendations/persist.ts`), not through this module - see
docs/DECISIONS.md (Phase 2 entry) for why those two were deliberately kept
separate.

This is what `src/lib/tools/execute.ts` calls into for every HIGH/CRITICAL-risk tool
call (BRD Section 21) — replacing the Day 5 hard block. See
`executeApprovedTool` there for how an approved request actually gets run, and
docs/DECISIONS.md for why.
