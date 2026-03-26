import { Hono } from 'hono'
import { discoverSessions } from '../data/session-discovery.ts'
import { getCachedTitle, setCachedTitle, getAllCachedTitles } from '../data/title-cache.ts'
import { parseConversation } from '../data/conversation-parser.ts'

// Read lazily so bun --watch picks up .env.local changes
function getTitleWorkerUrl(): string {
  return process.env.TITLE_WORKER_URL ?? ''
}

const app = new Hono()

app.get('/', async (c) => {
  const status = c.req.query('status') ?? 'all'
  const limit = parseInt(c.req.query('limit') ?? '50', 10)
  const offset = parseInt(c.req.query('offset') ?? '0', 10)

  let sessions = await discoverSessions()

  if (status === 'active') {
    sessions = sessions.filter((s) => s.isActive)
  } else if (status === 'inactive') {
    sessions = sessions.filter((s) => !s.isActive)
  }

  // Attach cached AI titles to session responses
  const titles = getAllCachedTitles()
  const total = sessions.length
  const paginated = sessions.slice(offset, offset + limit).map((s) => {
    const cached = titles[s.sessionId]
    return cached
      ? { ...s, aiTitle: cached.title, aiDescription: cached.description }
      : s
  })

  return c.json({ sessions: paginated, total })
})

app.get('/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  const sessions = await discoverSessions()
  const session = sessions.find((s) => s.sessionId === sessionId)

  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  const cached = getCachedTitle(sessionId)
  const result = cached
    ? { ...session, aiTitle: cached.title, aiDescription: cached.description }
    : session

  return c.json({ session: result })
})

// Generate AI title for a session
app.post('/:sessionId/title', async (c) => {
  const workerUrl = getTitleWorkerUrl()
  if (!workerUrl) {
    return c.json({ error: 'TITLE_WORKER_URL not configured' }, 500)
  }

  const sessionId = c.req.param('sessionId')

  // Check cache first
  const cached = getCachedTitle(sessionId)
  if (cached) {
    return c.json({ title: cached.title, description: cached.description, cached: true })
  }

  // Get the session to find its JSONL path
  const sessions = await discoverSessions()
  const session = sessions.find((s) => s.sessionId === sessionId)
  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  // Extract user messages for context: first (project context) + last few (recent work)
  const jsonlPath = (session as { jsonlPath?: string }).jsonlPath
  if (!jsonlPath) {
    return c.json({ error: 'No conversation data' }, 404)
  }

  const conversation = parseConversation(jsonlPath, 0, 50000)
  const allUserMessages = conversation.messages
    .filter((m) => m.type === 'user')
    .map((m) => {
      const text = m.content
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map((b) => b.text)
        .join(' ')
      return text.slice(0, 200)
    })
    .filter((t) => t.length > 0)

  if (allUserMessages.length === 0) {
    return c.json({ error: 'No user messages to summarize' }, 400)
  }

  // First message for project context, last 3 for recent activity
  const first = allUserMessages[0]
  const recent = allUserMessages.slice(-3)
  // Deduplicate if the session is short
  const contextMessages = first && !recent.includes(first)
    ? [first, ...recent]
    : recent

  try {
    const res = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: contextMessages }),
    })

    if (!res.ok) {
      const err = await res.text()
      return c.json({ error: `Worker error: ${err}` }, 502)
    }

    const { title, description } = (await res.json()) as { title: string; description: string }

    // Cache the result
    setCachedTitle(sessionId, title, description, session.messageCount)

    return c.json({ title, description, cached: false })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Worker request failed' }, 502)
  }
})

export default app
