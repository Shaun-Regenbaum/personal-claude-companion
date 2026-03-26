import { readFileSync, statSync } from 'fs'
import type { ConversationMessage, MessageContent } from '../../src/lib/types.ts'

interface ParsedConversation {
  messages: ConversationMessage[]
  total: number
}

// Cache parsed conversations by path + mtime
const parseCache = new Map<string, { mtime: number; messages: ConversationMessage[] }>()

export function parseConversation(
  jsonlPath: string,
  offset = 0,
  limit = 100,
  typeFilter?: string[],
): ParsedConversation {
  const messages = getAllMessages(jsonlPath)

  let filtered = messages
  if (typeFilter && typeFilter.length > 0) {
    filtered = messages.filter((m) => typeFilter.includes(m.type))
  }

  return {
    messages: filtered.slice(offset, offset + limit),
    total: filtered.length,
  }
}

function getAllMessages(jsonlPath: string): ConversationMessage[] {
  try {
    const stat = statSync(jsonlPath)
    const cached = parseCache.get(jsonlPath)
    if (cached && cached.mtime === stat.mtimeMs) {
      return cached.messages
    }

    const content = readFileSync(jsonlPath, 'utf-8')
    const lines = content.trim().split('\n')
    const messages: ConversationMessage[] = []

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const entry = JSON.parse(line)
        const msg = parseEntry(entry)
        if (msg) messages.push(msg)
      } catch {
        // Skip malformed lines
      }
    }

    parseCache.set(jsonlPath, { mtime: stat.mtimeMs, messages })
    return messages
  } catch {
    return []
  }
}

function parseEntry(entry: Record<string, unknown>): ConversationMessage | null {
  const type = entry.type as string
  if (!type) return null

  // Skip types that aren't useful for display
  const displayTypes = ['user', 'assistant', 'tool_use', 'tool_result', 'progress', 'agent_progress', 'file-history-snapshot', 'system']
  if (!displayTypes.includes(type)) return null

  const message = entry.message as Record<string, unknown> | undefined
  const content = extractContent(type, message, entry)

  return {
    uuid: (entry.uuid as string) ?? '',
    parentUuid: (entry.parentUuid as string) ?? null,
    type: type as ConversationMessage['type'],
    timestamp: (entry.timestamp as string) ?? '',
    content,
    model: message?.model as string | undefined,
    usage: message?.usage as ConversationMessage['usage'],
    isSidechain: (entry.isSidechain as boolean) ?? false,
  }
}

function extractContent(
  type: string,
  message: Record<string, unknown> | undefined,
  entry: Record<string, unknown>,
): MessageContent[] {
  if (!message?.content) {
    // Some types store content differently
    if (type === 'progress' || type === 'agent_progress') {
      const text = (entry.content as string) ?? (entry.message as Record<string, unknown>)?.content as string ?? ''
      return [{ type: 'text', text: typeof text === 'string' ? text : JSON.stringify(text) }]
    }
    if (type === 'file-history-snapshot') {
      return [{ type: 'text', text: '[Context compaction checkpoint]' }]
    }
    if (type === 'system') {
      const subtype = (entry.subtype as string) ?? ''
      return [{ type: 'text', text: `[System: ${subtype}]` }]
    }
    return []
  }

  const rawContent = message.content
  if (typeof rawContent === 'string') {
    return [{ type: 'text', text: rawContent }]
  }

  if (!Array.isArray(rawContent)) return []

  return rawContent.map((block: Record<string, unknown>): MessageContent => {
    if (block.type === 'text') {
      return { type: 'text', text: block.text as string }
    }
    if (block.type === 'tool_use') {
      return {
        type: 'tool_use',
        id: block.id as string,
        name: block.name as string,
        input: (block.input as Record<string, unknown>) ?? {},
      }
    }
    if (block.type === 'tool_result') {
      const content = block.content
      const innerContent: MessageContent[] = Array.isArray(content)
        ? content.map((c: Record<string, unknown>) => ({
            type: 'text' as const,
            text: (c.text as string) ?? JSON.stringify(c),
          }))
        : [{ type: 'text', text: typeof content === 'string' ? content : JSON.stringify(content) }]

      return {
        type: 'tool_result',
        tool_use_id: block.tool_use_id as string,
        content: innerContent,
      }
    }
    if (block.type === 'thinking') {
      return { type: 'thinking', thinking: block.thinking as string }
    }
    return { type: 'text', text: JSON.stringify(block) }
  })
}

export function invalidateConversationCache(jsonlPath: string): void {
  parseCache.delete(jsonlPath)
}

export function getConversationEdits(jsonlPath: string) {
  const messages = getAllMessages(jsonlPath)
  const edits: Array<{
    timestamp: string
    filePath: string
    toolName: string
    oldString?: string
    newString?: string
    content?: string
    messageUuid: string
  }> = []

  for (const msg of messages) {
    if (msg.type !== 'assistant') continue
    for (const block of msg.content) {
      if (block.type !== 'tool_use') continue
      if (block.name === 'Edit') {
        edits.push({
          timestamp: msg.timestamp,
          filePath: block.input.file_path as string,
          toolName: 'Edit',
          oldString: block.input.old_string as string,
          newString: block.input.new_string as string,
          messageUuid: msg.uuid,
        })
      } else if (block.name === 'Write') {
        edits.push({
          timestamp: msg.timestamp,
          filePath: block.input.file_path as string,
          toolName: 'Write',
          content: block.input.content as string,
          messageUuid: msg.uuid,
        })
      }
    }
  }

  return edits
}
