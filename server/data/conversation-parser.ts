import { readFileSync, statSync } from 'fs'
import type { ConversationMessage, MessageContent } from '../../src/lib/types.ts'

interface ParsedConversation {
  messages: ConversationMessage[]
  total: number
}

// Cache only ONE conversation at a time to avoid memory bloat
let parseCache: { path: string; mtime: number; messages: ConversationMessage[] } | null = null

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
    if (parseCache && parseCache.path === jsonlPath && parseCache.mtime === stat.mtimeMs) {
      return parseCache.messages
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

    parseCache = { path: jsonlPath, mtime: stat.mtimeMs, messages }
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
    if (block.type === 'image') {
      const source = block.source as Record<string, unknown>
      return {
        type: 'image',
        source: {
          type: (source?.type as string) ?? 'base64',
          media_type: (source?.media_type as string) ?? 'image/png',
          data: (source?.data as string) ?? '',
        },
      }
    }
    return { type: 'text', text: JSON.stringify(block) }
  })
}

export function invalidateConversationCache(jsonlPath: string): void {
  if (parseCache?.path === jsonlPath) parseCache = null
}

export interface FileOperation {
  timestamp: string
  filePath: string
  toolName: string
  toolUseId: string
  messageUuid: string
  // Edit
  oldString?: string
  newString?: string
  // Write
  content?: string
  // Read
  readContent?: string
  // Bash
  command?: string
  commandDescription?: string
  output?: string
}

export interface CommitInfo {
  hash: string
  message: string
  timestamp: string
  messageUuid: string
}

export function getFileOperations(jsonlPath: string): {
  operations: FileOperation[]
  commits: CommitInfo[]
} {
  const messages = getAllMessages(jsonlPath)
  const operations: FileOperation[] = []
  const commits: CommitInfo[] = []

  // Build tool result map for Read/Bash outputs
  const toolResultMap = new Map<string, string>()
  for (const msg of messages) {
    if (msg.type !== 'user') continue
    for (const block of msg.content) {
      if (block.type === 'tool_result' && block.tool_use_id) {
        const text = block.content
          .map((c) => (c.type === 'text' ? c.text : ''))
          .join('\n')
        toolResultMap.set(block.tool_use_id, text)
      }
    }
  }

  for (const msg of messages) {
    if (msg.type !== 'assistant') continue
    for (const block of msg.content) {
      if (block.type !== 'tool_use') continue

      const base = {
        timestamp: msg.timestamp,
        toolUseId: block.id,
        messageUuid: msg.uuid,
      }

      if (block.name === 'Edit') {
        operations.push({
          ...base,
          filePath: block.input.file_path as string,
          toolName: 'Edit',
          oldString: block.input.old_string as string,
          newString: block.input.new_string as string,
        })
      } else if (block.name === 'Write') {
        operations.push({
          ...base,
          filePath: block.input.file_path as string,
          toolName: 'Write',
          content: block.input.content as string,
        })
      } else if (block.name === 'Read') {
        const result = toolResultMap.get(block.id)
        operations.push({
          ...base,
          filePath: block.input.file_path as string,
          toolName: 'Read',
          readContent: result?.slice(0, 50000),
        })
      } else if (block.name === 'Bash') {
        const cmd = (block.input.command as string) ?? ''
        const result = toolResultMap.get(block.id)

        // Detect git commits
        if (cmd.includes('git commit')) {
          const hashMatch = result?.match(/\[[\w-]+ ([a-f0-9]+)\]/)
          const msgMatch = result?.match(/\] (.+)/)
          if (hashMatch) {
            commits.push({
              hash: hashMatch[1],
              message: msgMatch?.[1] ?? '',
              timestamp: msg.timestamp,
              messageUuid: msg.uuid,
            })
          }
        }

        operations.push({
          ...base,
          filePath: '',
          toolName: 'Bash',
          command: cmd,
          commandDescription: block.input.description as string,
          output: result?.slice(0, 20000),
        })
      }
    }
  }

  return { operations, commits }
}
