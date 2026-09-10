/** Base class for every error the AI Gateway raises. */
export class AiGatewayError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiGatewayError'
  }
}

/** Claude's response didn't validate against the requested schema, even after retry. */
export class InvalidAiOutputError extends AiGatewayError {
  constructor(message = 'AI response did not match the requested output schema.') {
    super(message)
    this.name = 'InvalidAiOutputError'
  }
}

/** A prompt template file (prompts/<category>/v<N>.md) could not be found or loaded. */
export class PromptNotFoundError extends AiGatewayError {
  constructor(message: string) {
    super(message)
    this.name = 'PromptNotFoundError'
  }
}

/** A prompt template referenced a variable that wasn't supplied, or vice versa. */
export class PromptVariableError extends AiGatewayError {
  constructor(message: string) {
    super(message)
    this.name = 'PromptVariableError'
  }
}
