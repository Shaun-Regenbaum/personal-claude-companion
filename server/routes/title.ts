import { Hono } from 'hono'
import { discoverSessions } from '../data/session-discovery.ts'
import { saveCompanionName } from '../data/session-discovery.ts'
import { parseConversation } from '../data/conversation-parser.ts'
import { getHookTurns } from '../data/activity-reader.ts'
import { getWorkerUrl, getCfAccessHeaders } from '../data/secrets.ts'
import { emit } from '../watch/event-bus.ts'
import { compressTurns, hookTurnsToCompressed } from './summary.ts'

const app = new Hono()

const inFlight = new Set<string>()

interface CompressedTurn {
  prompt: string
  response: string
  tools: string
}

async function generateTitle(sessionId: string, jsonlPath: string): Promise<string | null> {
  try {
    const { total, messages } = parseConversation(jsonlPath, 0, 0)
    if (total === 0) return null

    let turns: CompressedTurn[]
    const hookTurns = getHookTurns(sessionId)
    if (hookTurns && hookTurns.length > 0) {
      turns = hookTurnsToCompressed(hookTurns)
    } else {
      const offset = Math.max(0, total - 2000)
      const parsed = parseConversation(jsonlPath, offset, 2000)
      turns = compressTurns(parsed.messages)
    }

    if (turns.length === 0) return null

    // Send first 10 + last 5 turns (worker will also trim, but reduce payload)
    const selected = turns.length <= 15
      ? turns
      : [...turns.slice(0, 10), ...turns.slice(-5)]

    const workerUrl = getWorkerUrl()
    const accessHeaders = getCfAccessHeaders()

    const res = await fetch(`${workerUrl}/title`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...accessHeaders },
      body: JSON.stringify({ turns: selected }),
    })

    if (!res.ok) return null

    const data = await res.json() as { title?: string; error?: string }
    return data.title ?? null
  } catch (err) {
    console.error(`[title] Failed for ${sessionId}:`, err instanceof Error ? err.message : err)
    return null
  }
}

// Generate title for a single session
app.post('/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')

  try {
    const sessions = await discoverSessions()
    const session = sessions.find((s) => s.sessionId === sessionId)
    if (!session) {
      return c.json({ error: 'Session not found' }, 404)
    }

    const title = await generateTitle(sessionId, session.jsonlPath)
    if (!title) {
      return c.json({ error: 'Failed to generate title' }, 500)
    }

    saveCompanionName(sessionId, title)
    emit({ type: 'session-update', timestamp: new Date().toISOString() })
    console.log(`[title] ${sessionId}: "${title}"`)

    return c.json({ sessionId, title })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

// Batch generate titles for all sessions without companion names
app.post('/batch/all', async (c) => {
  if (inFlight.has('batch')) {
    return c.json({ error: 'Batch already in progress' }, 409)
  }
  inFlight.add('batch')

  try {
    const sessions = await discoverSessions()

    // Read current companion names to skip already-named sessions
    const { readFileSync, existsSync } = await import('fs')
    const { join } = await import('path')
    const namesPath = join(process.env.HOME ?? '', '.claude', 'companion-names.json')
    let existing: Record<string, string> = {}
    try {
      if (existsSync(namesPath)) {
        existing = JSON.parse(readFileSync(namesPath, 'utf-8'))
      }
    } catch {}

    const toProcess = sessions.filter((s) => !existing[s.sessionId])
    const titles: Record<string, string> = {}
    let updated = 0

    for (const session of toProcess) {
      const title = await generateTitle(session.sessionId, session.jsonlPath)
      if (title) {
        saveCompanionName(session.sessionId, title)
        titles[session.sessionId] = title
        updated++
        emit({ type: 'session-update', timestamp: new Date().toISOString() })
        console.log(`[title] batch ${updated}/${toProcess.length}: ${session.sessionId} -> "${title}"`)
      }
      // Small delay to respect rate limits
      await new Promise((r) => setTimeout(r, 1500))
    }

    return c.json({ updated, total: toProcess.length, titles })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({ error: message }, 500)
  } finally {
    inFlight.delete('batch')
  }
})

export default app
