import { Hono } from 'hono'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { discoverSessions } from '../data/session-discovery.ts'
import { getFileOperations } from '../data/conversation-parser.ts'

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

/**
 * Find git repos from: session cwd, or file paths in operations.
 * Returns unique repo roots.
 */
function findGitRepos(cwd: string, jsonlPath: string): string[] {
  const repos = new Set<string>()

  // Check session cwd
  if (cwd && isGitRepo(cwd)) {
    repos.add(cwd)
  }

  // Check file paths from operations to find repos the session worked in
  try {
    const { operations } = getFileOperations(jsonlPath)
    for (const op of operations) {
      if (!op.filePath) continue
      const repoRoot = findGitRoot(dirname(op.filePath))
      if (repoRoot) repos.add(repoRoot)
    }
  } catch {
    // ignore
  }

  return Array.from(repos)
}

function isGitRepo(dir: string): boolean {
  return existsSync(join(dir, '.git'))
}

function findGitRoot(dir: string): string | null {
  let current = dir
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(current, '.git'))) return current
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }
  return null
}

app.get('/:sessionId/log', async (c) => {
  const sessionId = c.req.param('sessionId')
  const limit = parseInt(c.req.query('limit') ?? '8', 10)

  const sessions = await discoverSessions()
  const session = sessions.find((s) => s.sessionId === sessionId)
  if (!session) {
    return c.json({ error: 'Session not found' }, 404)
  }

  const repos = findGitRepos(session.cwd, (session as any).jsonlPath)
  if (repos.length === 0) {
    return c.json({ entries: [], graph: '', repos: [] })
  }

  // Use the first repo (most likely the primary one)
  // If session cwd is a repo, prefer it; otherwise use the first found from file ops
  const cwd = repos[0]

  try {
    const graphRaw = execSync(
      `git log --graph --oneline --decorate --all -n ${limit}`,
      { cwd, encoding: 'utf-8', timeout: 5000 }
    ).trim()

    const logRaw = execSync(
      `git log --all -n ${limit} --format="%H%x00%h%x00%s%x00%an%x00%aI%x00%D"`,
      { cwd, encoding: 'utf-8', timeout: 5000 }
    ).trim()

    const graphLines = graphRaw.split('\n')
    const entries: GitLogEntry[] = logRaw.split('\n').filter(Boolean).map((line, i) => {
      const [hash, shortHash, message, author, date, refs] = line.split('\0')
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

    return c.json({ entries, graph: graphRaw, repos })
  } catch {
    return c.json({ entries: [], graph: '', repos })
  }
})

export default app
