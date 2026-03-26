import type { ConversationMessage, MessageContent } from './types.ts'

export interface TurnGroup {
  turnNumber: number
  userPrompt: string
  userTimestamp: string
  endTimestamp: string
  messages: ConversationMessage[]
  toolCalls: { name: string; filePath?: string }[]
  toolSummary: { name: string; count: number }[]
  hasThinking: boolean
  hasImages: boolean
  isCompaction: boolean
  assistantPreview: string
}

/**
 * Group conversation messages into turns.
 * A turn = one user message + all subsequent assistant/tool messages until the next user message.
 */
export function groupIntoTurns(messages: ConversationMessage[]): TurnGroup[] {
  const turns: TurnGroup[] = []
  let current: ConversationMessage[] = []
  let turnNumber = 0

  for (const msg of messages) {
    // Skip pure tool-result user messages (they don't start a new turn)
    if (msg.type === 'user') {
      const hasText = msg.content.some(
        (b) => b.type === 'text' && b.text.trim().length > 0
      )
      if (hasText) {
        // Flush previous turn
        if (current.length > 0) {
          turns.push(buildTurn(current, turnNumber))
          turnNumber++
        }
        current = [msg]
        continue
      }
    }

    // Compaction checkpoints get their own "turn"
    if (msg.type === 'file-history-snapshot') {
      if (current.length > 0) {
        turns.push(buildTurn(current, turnNumber))
        turnNumber++
      }
      turns.push({
        turnNumber,
        userPrompt: '',
        userTimestamp: msg.timestamp,
        endTimestamp: msg.timestamp,
        messages: [msg],
        toolCalls: [],
        toolSummary: [],
        hasThinking: false,
        hasImages: false,
        isCompaction: true,
        assistantPreview: '',
      })
      turnNumber++
      current = []
      continue
    }

    current.push(msg)
  }

  // Flush remaining
  if (current.length > 0) {
    turns.push(buildTurn(current, turnNumber))
  }

  return turns
}

function buildTurn(messages: ConversationMessage[], turnNumber: number): TurnGroup {
  let userPrompt = ''
  let userTimestamp = ''
  let endTimestamp = ''
  let assistantPreview = ''
  let hasThinking = false
  let hasImages = false
  const toolCalls: { name: string; filePath?: string }[] = []

  for (const msg of messages) {
    if (!endTimestamp || msg.timestamp > endTimestamp) {
      endTimestamp = msg.timestamp
    }

    if (msg.type === 'user' && !userPrompt) {
      userTimestamp = msg.timestamp
      for (const b of msg.content) {
        if (b.type === 'text' && b.text.trim()) {
          userPrompt = b.text.trim().slice(0, 120)
          break
        }
      }
    }

    if (msg.type === 'assistant') {
      for (const b of msg.content) {
        if (b.type === 'text' && b.text.trim() && !assistantPreview) {
          assistantPreview = b.text.trim().slice(0, 100)
        }
        if (b.type === 'tool_use') {
          const filePath = (b.input as Record<string, unknown>).file_path as string | undefined
          toolCalls.push({ name: b.name, filePath })
        }
        if (b.type === 'thinking') hasThinking = true
        if ((b as MessageContent & { type: 'image' }).type === 'image') hasImages = true
      }
    }
  }

  // Summarize tool calls by type
  const toolMap = new Map<string, number>()
  for (const tc of toolCalls) {
    toolMap.set(tc.name, (toolMap.get(tc.name) ?? 0) + 1)
  }
  const toolSummary = Array.from(toolMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  return {
    turnNumber,
    userPrompt,
    userTimestamp,
    endTimestamp,
    messages,
    toolCalls,
    toolSummary,
    hasThinking,
    hasImages,
    isCompaction: false,
    assistantPreview,
  }
}
