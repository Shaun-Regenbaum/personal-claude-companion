import { Hono } from 'hono'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { discoverSessions, saveCompanionName } from '../data/session-discovery.ts'
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
    const { total } = parseConversation(jsonlPath, 0, 1)
    if (total < 4) return null // Skip sessions with too few messages

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
    const title = data.title
    // Reject bad titles
    if (!title || title === 'Untitled Session' || title.length > 60) return null
    return title
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

const NAMES_PATH = join(process.env.HOME ?? '', '.claude', 'companion-names.json')

function loadExistingNames(): Record<string, string> {
  try {
    if (existsSync(NAMES_PATH)) {
      return JSON.parse(readFileSync(NAMES_PATH, 'utf-8'))
    }
  } catch {}
  return {}
}

async function nameUnnamedSessions(): Promise<{ updated: number }> {
  if (inFlight.has('batch')) return { updated: 0 }
  inFlight.add('batch')

  try {
    const sessions = await discoverSessions()
    const existing = loadExistingNames()
    const toProcess = sessions.filter((s) => !existing[s.sessionId])

    if (toProcess.length === 0) return { updated: 0 }

    let updated = 0
    for (const session of toProcess) {
      const title = await generateTitle(session.sessionId, session.jsonlPath)
      if (title) {
        saveCompanionName(session.sessionId, title)
        updated++
        emit({ type: 'session-update', timestamp: new Date().toISOString() })
        console.log(`[title] auto ${updated}/${toProcess.length}: ${session.sessionId} -> "${title}"`)
      }
      // Delay between calls to respect rate limits (20/min)
      await new Promise((r) => setTimeout(r, 3500))
    }

    return { updated }
  } catch (err) {
    console.error(`[title] auto-naming failed:`, err instanceof Error ? err.message : err)
    return { updated: 0 }
  } finally {
    inFlight.delete('batch')
  }
}

// Batch generate titles for all sessions without companion names
app.post('/batch/all', async (c) => {
  if (inFlight.has('batch')) {
    return c.json({ error: 'Batch already in progress' }, 409)
  }

  const result = await nameUnnamedSessions()
  return c.json(result)
})

// Background auto-naming: run on startup after a delay, then periodically
let autoNamingTimer: ReturnType<typeof setInterval> | null = null

export function startAutoNaming(): void {
  // Run 30s after startup to let everything initialize
  setTimeout(() => {
    nameUnnamedSessions()
  }, 30_000)

  // Then check every 10 minutes for new unnamed sessions
  autoNamingTimer = setInterval(() => {
    nameUnnamedSessions()
  }, 10 * 60_000)
}

export default app
