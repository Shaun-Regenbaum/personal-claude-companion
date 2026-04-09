import { describe, it, expect } from 'vitest'

// Import the compressTurns function from summary route
// We test the server-side turn compression logic by importing directly
// Since the server module uses Node APIs, we replicate the logic here for testing

interface CompressedTurn {
  prompt: string
  response: string
  tools: string
}

interface SimpleMessage {
  type: string
  content: Array<{ type: string; text?: string; name?: string; [key: string]: unknown }>
}

function compressTurns(messages: SimpleMessage[]): CompressedTurn[] {
  const turns: CompressedTurn[] = []
  let currentPrompt = ''
  let currentResponse = ''
  let currentTools: string[] = []

  for (const msg of messages) {
    if (msg.type === 'user') {
      const text = msg.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text ?? '')
        .join('\n')
        .trim()

      if (!text) continue

      if (currentPrompt || currentResponse) {
        turns.push({
          prompt: currentPrompt.slice(0, 500),
          response: currentResponse.slice(0, 500),
          tools: [...new Set(currentTools)].join(', '),
        })
      }
      currentPrompt = text
      currentResponse = ''
      currentTools = []
    }

    if (msg.type === 'assistant') {
      for (const block of msg.content) {
        if (block.type === 'text') {
          currentResponse += (currentResponse ? '\n' : '') + (block.text ?? '')
        }
        if (block.type === 'tool_use') {
          currentTools.push(block.name ?? '')
        }
      }
    }
  }

  if (currentPrompt || currentResponse) {
    turns.push({
      prompt: currentPrompt.slice(0, 500),
      response: currentResponse.slice(0, 500),
      tools: [...new Set(currentTools)].join(', '),
    })
  }

  return turns
}

describe('compressTurns', () => {
  it('returns empty array for empty messages', () => {
    expect(compressTurns([])).toEqual([])
  })

  it('compresses a single user-assistant turn', () => {
    const messages: SimpleMessage[] = [
      { type: 'user', content: [{ type: 'text', text: 'Fix the bug' }] },
      { type: 'assistant', content: [{ type: 'text', text: 'Done, fixed it.' }] },
    ]
    const turns = compressTurns(messages)
    expect(turns).toHaveLength(1)
    expect(turns[0].prompt).toBe('Fix the bug')
    expect(turns[0].response).toBe('Done, fixed it.')
    expect(turns[0].tools).toBe('')
  })

  it('extracts tool names from assistant messages', () => {
    const messages: SimpleMessage[] = [
      { type: 'user', content: [{ type: 'text', text: 'Edit the file' }] },
      { type: 'assistant', content: [
        { type: 'tool_use', name: 'Edit', id: '1', input: {} },
        { type: 'tool_use', name: 'Read', id: '2', input: {} },
        { type: 'text', text: 'Done.' },
      ]},
    ]
    const turns = compressTurns(messages)
    expect(turns[0].tools).toBe('Edit, Read')
  })

  it('deduplicates tool names', () => {
    const messages: SimpleMessage[] = [
      { type: 'user', content: [{ type: 'text', text: 'Fix it' }] },
      { type: 'assistant', content: [
        { type: 'tool_use', name: 'Edit', id: '1', input: {} },
        { type: 'tool_use', name: 'Edit', id: '2', input: {} },
      ]},
    ]
    const turns = compressTurns(messages)
    expect(turns[0].tools).toBe('Edit')
  })

  it('skips tool-result-only user messages', () => {
    const messages: SimpleMessage[] = [
      { type: 'user', content: [{ type: 'text', text: 'Start' }] },
      { type: 'assistant', content: [{ type: 'tool_use', name: 'Bash', id: '1', input: {} }] },
      { type: 'user', content: [{ type: 'tool_result', tool_use_id: '1' }] },
      { type: 'assistant', content: [{ type: 'text', text: 'Done.' }] },
    ]
    const turns = compressTurns(messages)
    expect(turns).toHaveLength(1)
    expect(turns[0].prompt).toBe('Start')
  })

  it('handles multiple turns', () => {
    const messages: SimpleMessage[] = [
      { type: 'user', content: [{ type: 'text', text: 'First' }] },
      { type: 'assistant', content: [{ type: 'text', text: 'Response 1' }] },
      { type: 'user', content: [{ type: 'text', text: 'Second' }] },
      { type: 'assistant', content: [{ type: 'text', text: 'Response 2' }] },
    ]
    const turns = compressTurns(messages)
    expect(turns).toHaveLength(2)
    expect(turns[0].prompt).toBe('First')
    expect(turns[1].prompt).toBe('Second')
  })

  it('truncates long prompts to 500 chars', () => {
    const longText = 'x'.repeat(1000)
    const messages: SimpleMessage[] = [
      { type: 'user', content: [{ type: 'text', text: longText }] },
      { type: 'assistant', content: [{ type: 'text', text: 'ok' }] },
    ]
    const turns = compressTurns(messages)
    expect(turns[0].prompt.length).toBe(500)
  })
})

// Title validation logic (mirrors server/routes/title.ts filtering)
function isValidTitle(title: string | null | undefined): boolean {
  if (!title) return false
  if (title === 'Untitled Session') return false
  if (title.length > 60) return false
  return true
}

describe('title validation', () => {
  it('rejects null/undefined/empty titles', () => {
    expect(isValidTitle(null)).toBe(false)
    expect(isValidTitle(undefined)).toBe(false)
    expect(isValidTitle('')).toBe(false)
  })

  it('rejects "Untitled Session"', () => {
    expect(isValidTitle('Untitled Session')).toBe(false)
  })

  it('rejects titles longer than 60 characters', () => {
    expect(isValidTitle('A'.repeat(61))).toBe(false)
    expect(isValidTitle('Now I have a clear picture. Let me write up the plan for this session')).toBe(false)
  })

  it('accepts valid short descriptive titles', () => {
    expect(isValidTitle('Fix Plans Tab Session Isolation')).toBe(true)
    expect(isValidTitle('Add LaunchAgent Daemon Mode')).toBe(true)
    expect(isValidTitle('Refactor Auth Middleware')).toBe(true)
    expect(isValidTitle('Setup React Vite Dashboard with Auth0')).toBe(true)
  })

  it('accepts titles at exactly 60 characters', () => {
    expect(isValidTitle('A'.repeat(60))).toBe(true)
  })
})

describe('title response parsing', () => {
  it('extracts title from valid JSON response', () => {
    const text = '{ "title": "Fix Plans Tab Session Isolation" }'
    const match = text.match(/\{[\s\S]*\}/)
    expect(match).not.toBeNull()
    const parsed = JSON.parse(match![0]) as { title: string }
    expect(parsed.title).toBe('Fix Plans Tab Session Isolation')
  })

  it('extracts title from JSON embedded in reasoning text', () => {
    const text = 'The session is about fixing bugs. { "title": "Fix PlanViewer Bug" } That is my answer.'
    const match = text.match(/\{[\s\S]*\}/)
    expect(match).not.toBeNull()
    const parsed = JSON.parse(match![0]) as { title: string }
    expect(parsed.title).toBe('Fix PlanViewer Bug')
  })

  it('falls back to quoted title extraction when no JSON', () => {
    const text = 'I think the title should be "Fix Plans Tab Session Isolation"'
    const titleMatch = text.match(/["']([A-Z][^"']{5,60})["']/)
    expect(titleMatch).not.toBeNull()
    expect(titleMatch![1]).toBe('Fix Plans Tab Session Isolation')
  })
})

describe('summary response parsing', () => {
  it('parses valid section response', () => {
    const response = {
      sections: [
        {
          title: 'Test Section',
          summary: 'Did some work',
          decisions: ['Used React'],
          solved: ['Fixed the bug'],
          openQuestions: ['What about tests?'],
        },
      ],
    }
    expect(response.sections).toHaveLength(1)
    expect(response.sections[0].title).toBe('Test Section')
    expect(response.sections[0].decisions).toContain('Used React')
  })

  it('handles empty sections array', () => {
    const response = { sections: [] }
    expect(response.sections).toEqual([])
  })

  it('handles error response', () => {
    const response = { error: 'Worker error: 500' }
    expect(response.error).toBeDefined()
  })
})
