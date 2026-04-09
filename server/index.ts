import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/bun'
import sessions from './routes/sessions.ts'
import conversations from './routes/conversations.ts'
import events from './routes/events.ts'
import plans from './routes/plans.ts'
import config from './routes/config.ts'
import git from './routes/git.ts'
import activity from './routes/activity.ts'
import summary from './routes/summary.ts'
import title from './routes/title.ts'
import { startFileWatcher } from './watch/file-watcher.ts'
import { startStorageBudget } from './data/storage-budget.ts'

const app = new Hono()

app.use('*', cors())

if (process.env.COMPANION_DEBUG) {
  app.use('*', logger())
}

app.route('/api/sessions', sessions)
app.route('/api/conversations', conversations)
app.route('/api/events', events)
app.route('/api/plans', plans)
app.route('/api/config', config)
app.route('/api/git', git)
app.route('/api/activity', activity)
app.route('/api/summary', summary)
app.route('/api/title', title)

app.get('/api/health', (c) => c.json({ ok: true, timestamp: new Date().toISOString() }))

// Serve built frontend from dist/ (no-op in dev when Vite proxies only /api/*)
app.use('/*', serveStatic({ root: './dist' }))
app.get('*', serveStatic({ root: './dist', path: '/index.html' }))

// Start background services
startFileWatcher()
startStorageBudget()

const port = parseInt(process.env.COMPANION_PORT ?? '3848', 10)
console.log(`[server] Claude Companion running on http://localhost:${port}`)

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 120,
}
