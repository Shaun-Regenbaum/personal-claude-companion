import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import sessions from './routes/sessions.ts'
import conversations from './routes/conversations.ts'
import events from './routes/events.ts'
import plans from './routes/plans.ts'
import config from './routes/config.ts'
import git from './routes/git.ts'
import activity from './routes/activity.ts'
import summary from './routes/summary.ts'
import { startFileWatcher } from './watch/file-watcher.ts'

const app = new Hono()

app.use('*', cors({ origin: 'http://localhost:3847' }))
app.use('*', logger())

app.route('/api/sessions', sessions)
app.route('/api/conversations', conversations)
app.route('/api/events', events)
app.route('/api/plans', plans)
app.route('/api/config', config)
app.route('/api/git', git)
app.route('/api/activity', activity)
app.route('/api/summary', summary)

app.get('/api/health', (c) => c.json({ ok: true, timestamp: new Date().toISOString() }))

// Start file watchers
startFileWatcher()

const port = parseInt(process.env.COMPANION_PORT ?? '3848', 10)
console.log(`[server] Claude Companion API running on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 120,
}
