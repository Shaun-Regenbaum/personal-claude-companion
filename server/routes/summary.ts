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

    const res = await fetch(`${workerUrl}/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...accessHeaders },
      body: JSON.stringify({ turns: recentTurns }),
    })

    if (!res.ok) return

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
    console.error(`[summary] Background generation failed:`, err instanceof Error ? err.message : err)
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

    // No cache — generate synchronously for first request
    // But if it's a huge session, return empty and generate in background
    if (total > 5000) {
      generateSummary(sessionId)
      return c.json({ sections: [], generating: true })
    }

    // Small enough session — generate inline
    await generateSummary(sessionId)
    const fresh = readDiskCache(sessionId)
    if (fresh) {
      return c.json(fresh.summary)
    }
    return c.json({ error: 'Failed to generate summary' }, 500)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[summary] Error:', message)
    return c.json({ error: message }, 500)
  }
})

export default app
export { compressTurns }
