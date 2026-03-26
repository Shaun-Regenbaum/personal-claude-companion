import { Hono } from 'hono'
import { getActivityEvents, getSessionActivitySummary } from '../data/activity-reader.ts'
import { getRecentTitles } from '../data/title-cache.ts'

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

app.get('/recent-titles', (c) => {
  const limit = parseInt(c.req.query('limit') ?? '5', 10)
  return c.json({ titles: getRecentTitles(limit) })
})

export default app
