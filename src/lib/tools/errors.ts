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
 * Thrown for any HIGH/CRITICAL-risk tool call. The Approval Engine
 * (docs/MVP-CHECKLIST.md, Day 10) doesn't exist yet, and BRD-PRD Section 21
 * defaults HIGH to "approval required" and CRITICAL to "approval always
 * required, no override" - with nothing to route an approval through,
 * the only safe behavior is to deny outright rather than execute
 * unchecked. Day 10 replaces this hard block with a real approval gate.
 */
export class RiskLevelBlockedError extends ToolError {
  constructor(toolKey: string, riskLevel: string) {
    super(
      `Tool "${toolKey}" is risk level ${riskLevel} and requires the Approval Engine, which does not exist yet (Day 10) - execution denied rather than run unchecked.`,
    )
    this.name = 'RiskLevelBlockedError'
  }
}
