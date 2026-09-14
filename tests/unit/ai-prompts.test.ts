import { describe, expect, it } from 'vitest'
import { PromptNotFoundError, PromptVariableError } from '@/lib/ai/errors'
import { loadPromptTemplate, renderPromptTemplate } from '@/lib/ai/prompts'

describe('prompt loading (against the real prompts/ directory)', () => {
  it('loads the latest version of a real prompt category', () => {
    const prompt = loadPromptTemplate('analytics')
    // v2 (Phase 3 - proposedActions) is now the latest; v1 stays on disk as the previous version.
    expect(prompt.version).toBe('v2')
    expect(prompt.content).toContain('Marketing Analytics Agent')
  })

  it('loads an explicit version when requested', () => {
    const prompt = loadPromptTemplate('analytics', 'v1')
    expect(prompt.version).toBe('v1')
  })

  it('throws PromptNotFoundError for an unknown category', () => {
    expect(() => loadPromptTemplate('nonexistent-category')).toThrow(PromptNotFoundError)
  })

  it('throws PromptNotFoundError for an unknown version of a real category', () => {
    expect(() => loadPromptTemplate('analytics', 'v999')).toThrow(PromptNotFoundError)
  })
})

describe('prompt template rendering', () => {
  it('interpolates {{variables}} into the template', () => {
    const rendered = renderPromptTemplate('Hello {{name}}, welcome to {{place}}.', {
      name: 'Alice',
      place: 'TargetGum',
    })
    expect(rendered).toBe('Hello Alice, welcome to TargetGum.')
  })

  it('throws when a referenced variable is missing', () => {
    expect(() => renderPromptTemplate('Hello {{name}}.', {})).toThrow(PromptVariableError)
  })

  it('throws when a supplied variable is never referenced (stale call site)', () => {
    expect(() => renderPromptTemplate('Hello.', { unused: 'x' })).toThrow(PromptVariableError)
  })

  it('refuses to interpolate a variable whose name looks like a secret', () => {
    expect(() =>
      renderPromptTemplate('Use {{apiKey}} to connect.', { apiKey: 'sk-not-actually-used' }),
    ).toThrow(PromptVariableError)
  })

  it('renders the real analytics prompt with its expected variable', () => {
    const { content } = loadPromptTemplate('analytics')
    const rendered = renderPromptTemplate(content, { client_name: 'Client A' })
    expect(rendered).toContain('Client A')
    expect(rendered).not.toContain('{{client_name}}')
  })

  it('renders the real reporting prompt, which takes no variables', () => {
    const { content } = loadPromptTemplate('reporting')
    expect(() => renderPromptTemplate(content, {})).not.toThrow()
  })
})
