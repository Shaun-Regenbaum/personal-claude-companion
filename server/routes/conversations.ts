import { Hono } from 'hono'
import { discoverSessions } from '../data/session-discovery.ts'
import { parseConversation, getFileOperations } from '../data/conversation-parser.ts'

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

export default app
