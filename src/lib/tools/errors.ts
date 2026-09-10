export class ToolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ToolError'
  }
}

export class ToolNotFoundError extends ToolError {
  constructor(toolKey: string) {
    super(`Tool "${toolKey}" not found, disabled, or has no registered implementation.`)
    this.name = 'ToolNotFoundError'
  }
}

export class ToolInputValidationError extends ToolError {
  constructor(toolKey: string, detail: string) {
    super(`Invalid input for tool "${toolKey}": ${detail}`)
    this.name = 'ToolInputValidationError'
  }
}

export class ToolOutputValidationError extends ToolError {
  constructor(toolKey: string, detail: string) {
    super(`Tool "${toolKey}" returned output that failed its own output schema: ${detail}`)
    this.name = 'ToolOutputValidationError'
  }
}

/**
 * Thrown for any HIGH/CRITICAL-risk tool call (BRD-PRD Section 21: HIGH
 * defaults to "approval required", CRITICAL to "approval always required,
 * no override"). Execution does NOT proceed - `execute.ts` creates a
 * PENDING Approval instead and throws this, carrying its id. Call
 * `executeApprovedTool(ctx, approvalId)` once a human approves it
 * (src/lib/approvals/approvals.ts `approveApproval`) to actually run the
 * tool. Before Day 10 this was a hard, unconditional block
 * (`RiskLevelBlockedError`, still thrown for CRITICAL-without-an-org-
 * policy-override cases and kept for any caller pattern matching on it) -
 * see docs/DECISIONS.md.
 */
export class ApprovalRequiredError extends ToolError {
  constructor(
    toolKey: string,
    riskLevel: string,
    public readonly approvalId: string,
  ) {
    super(
      `Tool "${toolKey}" is risk level ${riskLevel} and requires approval before it can execute. Approval request created: ${approvalId}.`,
    )
    this.name = 'ApprovalRequiredError'
  }
}

/**
 * Retained for any narrow case where an approval genuinely cannot be
 * created (e.g. the approval-creation call itself fails) - execution must
 * still never proceed unchecked for a HIGH/CRITICAL tool.
 */
export class RiskLevelBlockedError extends ToolError {
  constructor(toolKey: string, riskLevel: string) {
    super(
      `Tool "${toolKey}" is risk level ${riskLevel} and could not be routed through the Approval Engine - execution denied rather than run unchecked.`,
    )
    this.name = 'RiskLevelBlockedError'
  }
}
