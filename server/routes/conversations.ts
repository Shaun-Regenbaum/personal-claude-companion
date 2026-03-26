import { Hono } from 'hono'
import { discoverSessions } from '../data/session-discovery.ts'
import { parseConversation, getFileOperations } from '../data/conversation-parser.ts'
import { groupIntoTurns } from '../../src/lib/timeline-summarizer.ts'
import { getCachedTurnTitles, setCachedTurnTitles } from '../data/title-cache.ts'

const app = new Hono()

app.get('/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  const offset = parseInt(c.req.query('offset') ?? '0', 10)
  const limit = parseInt(c.req.query('limit') ?? '100', 10)
  const types = c.req.query('types')?.split(',')

  const sessions = await discoverSessions()
  const session = sessions.find((s) => s.sessionId === sessionId)
  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  const result = parseConversation(session.jsonlPath, offset, limit, types)

  return c.json({
    messages: result.messages,
    total: result.total,
    hasMore: offset + limit < result.total,
  })
})

app.get('/:sessionId/operations', async (c) => {
  const sessionId = c.req.param('sessionId')

  const sessions = await discoverSessions()
  const session = sessions.find((s) => s.sessionId === sessionId)
  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  const { operations, commits } = getFileOperations(session.jsonlPath)
  return c.json({ operations, commits })
})

// Generate AI titles for turns in a conversation
app.post('/:sessionId/turn-titles', async (c) => {
  const workerUrl = process.env.TITLE_WORKER_URL ?? ''
  if (!workerUrl) {
    return c.json({ error: 'TITLE_WORKER_URL not configured' }, 500)
  }

  const sessionId = c.req.param('sessionId')

  // Check cache
  const cached = getCachedTurnTitles(sessionId)
  if (cached) {
    return c.json({ titles: cached, cached: true })
  }

  const sessions = await discoverSessions()
  const session = sessions.find((s) => s.sessionId === sessionId)
  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  // Limit to 2000 messages to avoid OOM on huge sessions
  const conversation = parseConversation(session.jsonlPath, 0, 2000)
  const turns = groupIntoTurns(conversation.messages)

  // Filter out compactions and empty turns (same logic as SummaryView)
  const realTurns = turns.filter((t) =>
    !t.isCompaction && (t.userPrompt || t.assistantPreview || t.toolSummary.length > 0)
  )

  if (realTurns.length === 0) {
    return c.json({ titles: [], cached: false })
  }

  // Send ALL real turns to worker (it caps at 40 internally, taking the last 40)
  const turnData = realTurns.map((t) => ({
    userPrompt: t.userPrompt,
    assistantPreview: t.assistantPreview,
    tools: t.toolSummary.map((ts) => ts.count > 1 ? `${ts.name}x${ts.count}` : ts.name),
  }))

  try {
    const baseUrl = workerUrl.replace(/\/summarize$/, '')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    const res = await fetch(`${baseUrl}/summarize-turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ turns: turnData }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return c.json({ error: 'Worker error' }, 502)
    }

    const { titles } = (await res.json()) as { titles: string[] }

    // Map titles back to all turns (including compactions) by index
    const fullTitles: string[] = []
    let realIdx = 0
    for (const turn of turns) {
      const isEmpty = turn.isCompaction ||
        (!turn.userPrompt && !turn.assistantPreview && turn.toolSummary.length === 0)
      if (isEmpty) {
        fullTitles.push('')
      } else {
        fullTitles.push(titles[realIdx] ?? '')
        realIdx++
      }
    }

    setCachedTurnTitles(sessionId, fullTitles)
    return c.json({ titles: fullTitles, cached: false })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Failed' }, 502)
  }
})

export default app
