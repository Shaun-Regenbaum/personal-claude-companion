import { Hono } from 'hono'
import { discoverSessions, pinSession, unpinSession, invalidateSessionCache } from '../data/session-discovery.ts'

const app = new Hono()

app.get('/', async (c) => {
  const status = c.req.query('status') ?? 'all'
  const limit = parseInt(c.req.query('limit') ?? '50', 10)
  const offset = parseInt(c.req.query('offset') ?? '0', 10)

  let sessions = await discoverSessions()

  if (status === 'active') sessions = sessions.filter((s) => s.isActive)
  else if (status === 'inactive') sessions = sessions.filter((s) => !s.isActive)

  const total = sessions.length
  const paginated = sessions.slice(offset, offset + limit)

  return c.json({ sessions: paginated, total })
})

app.get('/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId')
  const sessions = await discoverSessions()
  const session = sessions.find((s) => s.sessionId === sessionId)
  if (!session) return c.json({ error: 'Session not found' }, 404)
  return c.json({ session })
})

app.put('/:sessionId/pin', async (c) => {
  const sessionId = c.req.param('sessionId')
  pinSession(sessionId)
  invalidateSessionCache()
  return c.json({ ok: true })
})

app.delete('/:sessionId/pin', async (c) => {
  const sessionId = c.req.param('sessionId')
  unpinSession(sessionId)
  invalidateSessionCache()
  return c.json({ ok: true })
})

export default app
