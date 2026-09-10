import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { PromptNotFoundError, PromptVariableError } from './errors'

/**
 * Prompt versioning (BRD-PRD Section 70): prompts live at
 * `prompts/<category>/v<N>.md` and every AI run records which version it
 * used (ai_runs.promptVersion). Never silently change a prompt in place -
 * add a new vN.md file instead.
 */

const PROMPTS_ROOT = join(process.cwd(), 'prompts')
const VERSION_FILE_PATTERN = /^v(\d+)\.md$/

export interface PromptTemplate {
  category: string
  version: string
  content: string
}

/** Highest version number available for a category, as "v<N>" (e.g. "v1"). */
function resolveLatestVersion(category: string): string {
  let files: string[]
  try {
    files = readdirSync(join(PROMPTS_ROOT, category))
  } catch {
    throw new PromptNotFoundError(`No prompt directory for category "${category}".`)
  }

  const versions = files
    .map((file) => VERSION_FILE_PATTERN.exec(file))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => Number(match[1]))

  if (versions.length === 0) {
    throw new PromptNotFoundError(`No versioned prompt files found for category "${category}".`)
  }

  return `v${Math.max(...versions)}`
}

/** Loads a prompt template. Defaults to the latest version for `category` when `version` is omitted. */
export function loadPromptTemplate(category: string, version?: string): PromptTemplate {
  const resolvedVersion = version ?? resolveLatestVersion(category)
  const filePath = join(PROMPTS_ROOT, category, `${resolvedVersion}.md`)

  let content: string
  try {
    content = readFileSync(filePath, 'utf8')
  } catch {
    throw new PromptNotFoundError(`Prompt "${category}/${resolvedVersion}.md" not found.`)
  }

  return { category, version: resolvedVersion, content }
}

// Variable *names* that must never be interpolated into a prompt, per
// docs/SECURITY.md ("secrets never enter prompts"). This is a best-effort
// static guard on keys, not a scan of arbitrary business-data values - it
// catches the obvious mistake of passing a credential object through.
const FORBIDDEN_VARIABLE_NAME_PATTERN =
  /secret|password|passwd|token|api[-_]?key|credential|private[-_]?key|refresh[-_]?token/i

/**
 * Interpolates `{{variableName}}` placeholders in `template` with `variables`.
 * Throws PromptVariableError if a variable name looks like a secret, if the
 * template references a variable that wasn't supplied, or if a supplied
 * variable is never referenced (catches stale/misspelled call sites).
 */
export function renderPromptTemplate(template: string, variables: Record<string, string> = {}): string {
  for (const key of Object.keys(variables)) {
    if (FORBIDDEN_VARIABLE_NAME_PATTERN.test(key)) {
      throw new PromptVariableError(
        `Refusing to interpolate variable "${key}" into a prompt - its name looks like a secret (docs/SECURITY.md).`,
      )
    }
  }

  const referenced = new Set<string>()
  const rendered = template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    referenced.add(key)
    if (!(key in variables)) {
      throw new PromptVariableError(`Prompt references "{{${key}}}" but no value was provided.`)
    }
    return variables[key]!
  })

  const unused = Object.keys(variables).filter((key) => !referenced.has(key))
  if (unused.length > 0) {
    throw new PromptVariableError(`Unused prompt variable(s): ${unused.join(', ')}.`)
  }

  return rendered
}
