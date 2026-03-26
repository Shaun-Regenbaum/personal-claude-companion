import { Hono } from 'hono'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { discoverSessions } from '../data/session-discovery.ts'

const app = new Hono()

interface GitLogEntry {
  hash: string
  shortHash: string
  message: string
  author: string
  date: string
  refs: string
  graph: string
}

app.get('/:sessionId/log', async (c) => {
  const sessionId = c.req.param('sessionId')
  const limit = parseInt(c.req.query('limit') ?? '8', 10)

  const sessions = await discoverSessions()
  const session = sessions.find((s) => s.sessionId === sessionId)
  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  const cwd = session.cwd
  if (!cwd || !existsSync(join(cwd, '.git'))) {
    return c.json({ entries: [], graph: '' })
  }

  try {
    // Get graph + structured log
    const graphRaw = execSync(
      `git log --graph --oneline --decorate --all -n ${limit}`,
      { cwd, encoding: 'utf-8', timeout: 5000 }
    ).trim()

    // Get structured entries
    const logRaw = execSync(
      `git log --all -n ${limit} --format="%H%x00%h%x00%s%x00%an%x00%aI%x00%D"`,
      { cwd, encoding: 'utf-8', timeout: 5000 }
    ).trim()

    const entries: GitLogEntry[] = logRaw.split('\n').filter(Boolean).map((line, i) => {
      const [hash, shortHash, message, author, date, refs] = line.split('\0')
      const graphLines = graphRaw.split('\n')
      return {
        hash,
        shortHash,
        message,
        author,
        date,
        refs: refs || '',
        graph: graphLines[i] ?? '',
      }
    })

    return c.json({ entries, graph: graphRaw })
  } catch {
    return c.json({ entries: [], graph: '' })
  }
})

export default app
