import { Hono } from 'hono'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { discoverSessions } from '../data/session-discovery.ts'
import { parseConversation } from '../data/conversation-parser.ts'
import { getHookTurns } from '../data/activity-reader.ts'
import { getWorkerUrl, getCfAccessHeaders } from '../data/secrets.ts'
import { emit } from '../watch/event-bus.ts'
import type { ConversationMessage } from '../../src/lib/types.ts'

const app = new Hono()

const CACHE_DIR = join(process.env.HOME ?? '', '.claude', 'companion-summaries')

// Ensure cache dir exists
try { mkdirSync(CACHE_DIR, { recursive: true }) } catch {}

// Track in-flight requests to avoid duplicate generation
const inFlight = new Set<string>()

interface CachedSummary {
  messageCount: number
  generatedAt: string
  summary: { sections: unknown[] }
}

interface CompressedTurn {
  prompt: string
  response: string
  tools: string
}

function readDiskCache(sessionId: string): CachedSummary | null {
  const path = join(CACHE_DIR, `${sessionId}.json`)
  try {
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

function writeDiskCache(sessionId: string, data: CachedSummary): void {
  const path = join(CACHE_DIR, `${sessionId}.json`)
  try {
    writeFileSync(path, JSON.stringify(data), 'utf-8')
  } catch {}
}

function compressTurns(messages: ConversationMessage[]): CompressedTurn[] {
  const turns: CompressedTurn[] = []
  let currentPrompt = ''
  let currentResponse = ''
  let currentTools: string[] = []

  for (const msg of messages) {
    if (msg.type === 'user') {
      const text = msg.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { text: string }).text)
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
          currentResponse += (currentResponse ? '\n' : '') + block.text
        }
        if (block.type === 'tool_use') {
          currentTools.push(block.name)
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

function hookTurnsToCompressed(hookTurns: NonNullable<ReturnType<typeof getHookTurns>>): CompressedTurn[] {
  return hookTurns.map((ht) => ({
    prompt: ht.userPrompt,
    response: ht.assistantPreview,
    tools: ht.toolSummary.map((t) => `${t.name}${t.count > 1 ? ` x${t.count}` : ''}`).join(', '),
  }))
}

async function generateSummary(sessionId: string): Promise<void> {
  if (inFlight.has(sessionId)) return
  inFlight.add(sessionId)

  emit({ type: 'generation-started', sessionId, timestamp: new Date().toISOString() })

  try {
    const sessions = await discoverSessions()
    const session = sessions.find((s) => s.sessionId === sessionId)
    if (!session) return

    const { total } = parseConversation(session.jsonlPath, 0, 1)

    // Build compressed turns — prefer hook data, fall back to parsing
    // Only parse the last 2000 messages to avoid memory issues on large sessions
    let turns: CompressedTurn[]
    const hookTurns = getHookTurns(sessionId)
    if (hookTurns && hookTurns.length > 0) {
      turns = hookTurnsToCompressed(hookTurns)
    } else {
      const offset = Math.max(0, total - 2000)
      const { messages } = parseConversation(session.jsonlPath, offset, 2000)
      turns = compressTurns(messages)
    }

    if (turns.length === 0) return

    const recentTurns = turns.slice(-40)
    const workerUrl = getWorkerUrl()
    const accessHeaders = getCfAccessHeaders()

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60_000)

    const res = await fetch(`${workerUrl}/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...accessHeaders },
      body: JSON.stringify({ turns: recentTurns }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new Error(`Worker returned ${res.status}: ${errBody.slice(0, 200)}`)
    }

    const summary = await res.json() as { sections: unknown[] }

    writeDiskCache(sessionId, {
      messageCount: total,
      generatedAt: new Date().toISOString(),
      summary,
    })

    // Notify UI that summary is ready
    emit({ type: 'summary-update', sessionId, timestamp: new Date().toISOString() })
    console.log(`[summary] Generated for ${sessionId} (${turns.length} turns)`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate summary'
    console.error(`[summary] Background generation failed:`, message)
    emit({ type: 'generation-failed', sessionId, timestamp: new Date().toISOString(), error: message })
  } finally {
    inFlight.delete(sessionId)
  }
}

app.post('/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')

  try {
    const sessions = await discoverSessions()
    const session = sessions.find((s) => s.sessionId === sessionId)
    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }

    const { total } = parseConversation(session.jsonlPath, 0, 1)
    const cached = readDiskCache(sessionId)

    if (cached) {
      // Return cached summary immediately
      if (cached.messageCount !== total && !inFlight.has(sessionId)) {
        // Stale — trigger background refresh
        generateSummary(sessionId)
      }
      return c.json({ ...cached.summary, cached: true, stale: cached.messageCount !== total })
    }

    // No cache — return immediately and generate in background
    generateSummary(sessionId)
    return c.json({ sections: [], generating: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[summary] Error:', message)
    return c.json({ error: message }, 500)
  }
})

async function refreshSummaries(): Promise<void> {
  try {
    const sessions = await discoverSessions()
    // Sort by most recently modified, take top 20
    const recent = sessions
      .sort((a, b) => b.lastModified - a.lastModified)
      .slice(0, 20)

    let generated = 0
    for (const session of recent) {
      const { total } = parseConversation(session.jsonlPath, 0, 1)
      if (total < 4) continue

      const cached = readDiskCache(session.sessionId)
      if (cached && cached.messageCount === total) continue

      // Stale or missing — generate in background
      await generateSummary(session.sessionId)
      generated++
    }

    if (generated > 0) {
      console.log(`[summary] Background refresh: generated ${generated} summaries`)
    }
  } catch (err) {
    console.error('[summary] Background refresh failed:', err instanceof Error ? err.message : err)
  }
}

export function startAutoSummaries(): void {
  // Run 45s after startup to let secrets and watchers initialize
  setTimeout(() => {
    refreshSummaries()
  }, 45_000)

  // Then refresh every 10 minutes
  setInterval(() => {
    refreshSummaries()
  }, 10 * 60_000)
}

// Debounced per-session refresh triggered by conversation file changes
const conversationDebounce = new Map<string, ReturnType<typeof setTimeout>>()

export function onConversationChanged(sessionId: string): void {
  const existing = conversationDebounce.get(sessionId)
  if (existing) clearTimeout(existing)

  // Wait 30s after last change before regenerating (avoids thrashing during active use)
  conversationDebounce.set(sessionId, setTimeout(() => {
    conversationDebounce.delete(sessionId)
    generateSummary(sessionId)
  }, 30_000))
}

export default app
export { compressTurns, hookTurnsToCompressed }
