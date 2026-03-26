import { Hono } from 'hono'
import { discoverSessions } from '../data/session-discovery.ts'
import { getCached, setCached } from '../data/title-cache.ts'
import { parseConversation } from '../data/conversation-parser.ts'
import { groupIntoTurns } from '../../src/lib/timeline-summarizer.ts'

function getWorkerUrl(): string {
  return process.env.TITLE_WORKER_URL ?? ''
}

const app = new Hono()

app.get('/', async (c) => {
  const status = c.req.query('status') ?? 'all'
  const limit = parseInt(c.req.query('limit') ?? '50', 10)
  const offset = parseInt(c.req.query('offset') ?? '0', 10)

  let sessions = await discoverSessions()

  if (status === 'active') sessions = sessions.filter((s) => s.isActive)
  else if (status === 'inactive') sessions = sessions.filter((s) => !s.isActive)

  const total = sessions.length
  const paginated = sessions.slice(offset, offset + limit).map((s) => {
    const cached = getCached(s.sessionId)
    return cached ? { ...s, aiTitle: cached.title, aiDescription: cached.description } : s
  })

  return c.json({ sessions: paginated, total })
})

app.get('/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  const sessions = await discoverSessions()
  const session = sessions.find((s) => s.sessionId === sessionId)
  if (!session) return c.json({ error: 'Session not found' }, 404)

  const cached = getCached(sessionId)
  return c.json({
    session: cached
      ? { ...session, aiTitle: cached.title, aiDescription: cached.description }
      : session,
  })
})

// Generate AI summary for a session (title + description + turn titles)
app.post('/:sessionId/summarize', async (c) => {
  const workerUrl = getWorkerUrl()
  if (!workerUrl) return c.json({ error: 'TITLE_WORKER_URL not configured' }, 500)

  const sessionId = c.req.param('sessionId')
  const cached = getCached(sessionId)
  if (cached) return c.json(cached)

  const sessions = await discoverSessions()
  const session = sessions.find((s) => s.sessionId === sessionId)
  if (!session) return c.json({ error: 'Session not found' }, 404)

  const jsonlPath = (session as { jsonlPath?: string }).jsonlPath
  if (!jsonlPath) return c.json({ error: 'No conversation data' }, 404)

  // Parse and group into turns
  const conversation = parseConversation(jsonlPath, 0, 3000)
  const allTurns = groupIntoTurns(conversation.messages)

  // Filter to real turns (skip compactions and empty)
  const realTurns = allTurns.filter((t) =>
    !t.isCompaction && (t.userPrompt || t.assistantPreview || t.toolSummary.length > 0)
  )

  if (realTurns.length === 0) return c.json({ error: 'No turns to summarize' }, 400)

  // Build full context for each turn — no truncation on user prompts
  const turnData = realTurns.map((t) => ({
    prompt: t.userPrompt || '(no prompt)',
    response: t.assistantPreview || '',
    tools: t.toolSummary.map((ts) => ts.count > 1 ? `${ts.name}x${ts.count}` : ts.name).join(', ') || 'none',
  }))

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    const res = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turns: turnData }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) return c.json({ error: 'Worker error' }, 502)

    const result = await res.json() as {
      title: string
      description: string
      turnTitles: string[]
    }

    // Map turn titles back to full turn list (with empty strings for compactions)
    const fullTurnTitles: string[] = []
    let realIdx = 0
    for (const turn of allTurns) {
      const isEmpty = turn.isCompaction ||
        (!turn.userPrompt && !turn.assistantPreview && turn.toolSummary.length === 0)
      if (isEmpty) {
        fullTurnTitles.push('')
      } else {
        fullTurnTitles.push(result.turnTitles[realIdx] ?? '')
        realIdx++
      }
    }

    const summary = {
      title: result.title,
      description: result.description,
      turnTitles: fullTurnTitles,
      generatedAt: new Date().toISOString(),
    }

    setCached(sessionId, summary)
    return c.json(summary)
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Failed' }, 502)
  }
})

export default app
