import { Hono } from 'hono'
import { getActivityEvents, getSessionActivitySummary, getHookTurns } from '../data/activity-reader.ts'

const app = new Hono()

app.get('/', (c) => {
  const session = c.req.query('session')
  const since = c.req.query('since')
  const events = getActivityEvents(session ?? undefined, since ?? undefined)
  return c.json({ events })
})

app.get('/summary/:sessionId', (c) => {
  const sessionId = c.req.param('sessionId')
  const summary = getSessionActivitySummary(sessionId)
  return c.json(summary)
})

app.get('/turns/:sessionId', (c) => {
  const sessionId = c.req.param('sessionId')
  const turns = getHookTurns(sessionId)
  if (turns) {
    return c.json({ turns, source: 'hooks' })
  }
  return c.json({ turns: null, source: 'fallback' })
})

export default app
