import { describe, it, expect } from 'vitest'
import { getToolSummary, getEditStats, shortPath, formatInput } from '../../components/timeline/ToolCallBlock'

describe('shortPath', () => {
  it('returns empty string for undefined', () => {
    expect(shortPath(undefined)).toBe('')
  })

  it('returns short paths unchanged', () => {
    expect(shortPath('src/file.ts')).toBe('src/file.ts')
  })

  it('abbreviates long paths', () => {
    expect(shortPath('/Users/name/project/src/lib/utils.ts')).toBe('.../src/lib/utils.ts')
  })
})

describe('getToolSummary', () => {
  it('returns shortened path for Edit', () => {
    expect(getToolSummary('Edit', { file_path: '/a/b/c/d/e.ts' })).toBe('.../c/d/e.ts')
  })

  it('returns shortened path for Write', () => {
    expect(getToolSummary('Write', { file_path: 'src/file.ts' })).toBe('src/file.ts')
  })

  it('returns shortened path for Read', () => {
    expect(getToolSummary('Read', { file_path: 'src/file.ts' })).toBe('src/file.ts')
  })

  it('returns description for Bash', () => {
    expect(getToolSummary('Bash', { description: 'Run tests', command: 'npm test' })).toBe('Run tests')
  })

  it('falls back to command for Bash without description', () => {
    expect(getToolSummary('Bash', { command: 'npm test' })).toBe('npm test')
  })

  it('returns pattern and path for Grep', () => {
    expect(getToolSummary('Grep', { pattern: 'TODO', path: 'src' })).toBe('"TODO" src')
  })

  it('returns pattern for Glob', () => {
    expect(getToolSummary('Glob', { pattern: '**/*.ts' })).toBe('**/*.ts')
  })

  it('returns description for Agent', () => {
    expect(getToolSummary('Agent', { description: 'Search codebase' })).toBe('Search codebase')
  })

  it('returns query for WebSearch', () => {
    expect(getToolSummary('WebSearch', { query: 'vitest setup' })).toBe('vitest setup')
  })

  it('returns empty string for unknown tools', () => {
    expect(getToolSummary('Unknown', {})).toBe('')
  })
})

describe('getEditStats', () => {
  it('returns line counts for Edit', () => {
    expect(getEditStats('Edit', {
      old_string: 'line1\nline2',
      new_string: 'line1\nline2\nline3',
    })).toBe('+3 -2')
  })

  it('returns line count for Write', () => {
    expect(getEditStats('Write', { content: 'a\nb\nc' })).toBe('3L')
  })

  it('handles empty Edit strings', () => {
    expect(getEditStats('Edit', {})).toBe('+1 -1')
  })

  it('handles empty Write content', () => {
    expect(getEditStats('Write', {})).toBe('1L')
  })

  it('returns empty string for other tools', () => {
    expect(getEditStats('Read', {})).toBe('')
  })
})

describe('formatInput', () => {
  it('formats Edit with old/new strings', () => {
    const result = formatInput('Edit', {
      file_path: 'src/file.ts',
      old_string: 'old code',
      new_string: 'new code',
    })
    expect(result).toContain('src/file.ts')
    expect(result).toContain('--- old ---')
    expect(result).toContain('old code')
    expect(result).toContain('+++ new +++')
    expect(result).toContain('new code')
  })

  it('formats Bash with command', () => {
    expect(formatInput('Bash', { command: 'npm test' })).toBe('npm test')
  })

  it('formats Write with truncation', () => {
    const longContent = 'x'.repeat(3000)
    const result = formatInput('Write', { file_path: 'file.ts', content: longContent })
    expect(result).toContain('file.ts')
    expect(result.length).toBeLessThan(3000)
    expect(result).toContain('...')
  })

  it('formats Agent with description and type', () => {
    const result = formatInput('Agent', {
      description: 'Search codebase',
      subagent_type: 'Explore',
      prompt: 'Find all files',
    })
    expect(result).toContain('Description: Search codebase')
    expect(result).toContain('Type: Explore')
    expect(result).toContain('Prompt:\nFind all files')
  })

  it('truncates long Agent prompts', () => {
    const longPrompt = 'x'.repeat(500)
    const result = formatInput('Agent', { prompt: longPrompt })
    expect(result).toContain('... (truncated)')
    expect(result.length).toBeLessThan(500)
  })

  it('falls back to JSON for unknown tools', () => {
    const result = formatInput('Unknown', { key: 'value' })
    expect(result).toBe(JSON.stringify({ key: 'value' }, null, 2))
  })
})
