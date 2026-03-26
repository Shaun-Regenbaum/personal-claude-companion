import { readdirSync, readFileSync, statSync, existsSync } from 'fs'
import { join, basename } from 'path'
import { isPidAlive } from './session-state.ts'
import { findDisplayNameForSession, invalidateHistoryCache } from './history-index.ts'

const CLAUDE_DIR = join(process.env.HOME ?? '', '.claude')
const SESSIONS_DIR = join(CLAUDE_DIR, 'sessions')
const PROJECTS_DIR = join(CLAUDE_DIR, 'projects')
const DESKTOP_SESSIONS_DIR = join(
  process.env.HOME ?? '',
  'Library/Application Support/Claude/claude-code-sessions'
)

interface SessionMetadata {
  pid: number
  sessionId: string
  cwd: string
  startedAt: number
  kind: string
  entrypoint: string
}

interface DiscoveredSession {
  sessionId: string
  pid?: number
  cwd: string
  projectName: string
  startedAt: number
  lastActivityAt: number
  entrypoint: 'cli' | 'desktop' | 'unknown'
  isActive: boolean
  displayName: string
  messageCount: number
  gitBranch?: string
  version?: string
  jsonlPath: string
}

// Cache
let sessionCache: DiscoveredSession[] = []
let lastDiscoveryTime = 0
const CACHE_TTL_MS = 5_000

export async function discoverSessions(forceRefresh = false): Promise<DiscoveredSession[]> {
  const now = Date.now()
  if (!forceRefresh && sessionCache.length > 0 && now - lastDiscoveryTime < CACHE_TTL_MS) {
    return sessionCache
  }

  const activePids = await getActiveSessionPids()
  const sessions = new Map<string, DiscoveredSession>()

  // Scan project directories for JSONL files
  scanProjectsDir(sessions, activePids)

  // Check desktop sessions
  scanDesktopSessions(sessions, activePids)

  // Sort by last activity (most recent first)
  sessionCache = Array.from(sessions.values()).sort(
    (a, b) => b.lastActivityAt - a.lastActivityAt
  )
  lastDiscoveryTime = now

  return sessionCache
}

async function getActiveSessionPids(): Promise<Map<string, SessionMetadata>> {
  const map = new Map<string, SessionMetadata>()

  if (!existsSync(SESSIONS_DIR)) return map

  const files = readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'))
  for (const file of files) {
    try {
      const content = readFileSync(join(SESSIONS_DIR, file), 'utf-8')
      const meta: SessionMetadata = JSON.parse(content)
      if (meta.sessionId) {
        const alive = await isPidAlive(meta.pid)
        if (alive) {
          map.set(meta.sessionId, meta)
        }
      }
    } catch {
      // Skip malformed files
    }
  }

  return map
}

function scanProjectsDir(
  sessions: Map<string, DiscoveredSession>,
  activePids: Map<string, SessionMetadata>,
): void {
  if (!existsSync(PROJECTS_DIR)) return

  const projectDirs = readdirSync(PROJECTS_DIR)
  for (const projectDir of projectDirs) {
    const projectPath = join(PROJECTS_DIR, projectDir)
    let stat
    try {
      stat = statSync(projectPath)
    } catch {
      continue
    }
    if (!stat.isDirectory()) continue

    const files = readdirSync(projectPath).filter((f) => f.endsWith('.jsonl'))
    for (const file of files) {
      const sessionId = file.replace('.jsonl', '')
      const jsonlPath = join(projectPath, file)

      try {
        const fileStat = statSync(jsonlPath)
        const sessionMeta = activePids.get(sessionId)

        // Read first few lines to get metadata
        const { cwd, startedAt, gitBranch, version, messageCount, displayName } =
          parseSessionHeader(jsonlPath, sessionId)

        sessions.set(sessionId, {
          sessionId,
          pid: sessionMeta?.pid,
          cwd: cwd || decodeProjectDir(projectDir),
          projectName: basename(cwd || decodeProjectDir(projectDir)),
          startedAt: startedAt || fileStat.birthtimeMs,
          lastActivityAt: fileStat.mtimeMs,
          entrypoint: (sessionMeta?.entrypoint as 'cli' | 'desktop') ?? 'cli',
          isActive: activePids.has(sessionId),
          displayName: displayName || sessionId.slice(0, 8),
          messageCount,
          gitBranch,
          version,
          jsonlPath,
        })
      } catch {
        // Skip unreadable files
      }
    }
  }
}

function scanDesktopSessions(
  sessions: Map<string, DiscoveredSession>,
  activePids: Map<string, SessionMetadata>,
): void {
  if (!existsSync(DESKTOP_SESSIONS_DIR)) return

  try {
    const files = readdirSync(DESKTOP_SESSIONS_DIR).filter((f) => f.endsWith('.jsonl'))
    for (const file of files) {
      const sessionId = file.replace('.jsonl', '')
      if (sessions.has(sessionId)) continue // Already found in projects

      const jsonlPath = join(DESKTOP_SESSIONS_DIR, file)
      try {
        const fileStat = statSync(jsonlPath)
        const { cwd, startedAt, gitBranch, version, messageCount, displayName } =
          parseSessionHeader(jsonlPath, sessionId)

        sessions.set(sessionId, {
          sessionId,
          pid: undefined,
          cwd: cwd || '',
          projectName: basename(cwd || 'Desktop'),
          startedAt: startedAt || fileStat.birthtimeMs,
          lastActivityAt: fileStat.mtimeMs,
          entrypoint: 'desktop',
          isActive: activePids.has(sessionId),
          displayName: displayName || sessionId.slice(0, 8),
          messageCount,
          gitBranch,
          version,
          jsonlPath,
        })
      } catch {
        // Skip
      }
    }
  } catch {
    // Desktop dir might not exist
  }
}

function parseSessionHeader(
  jsonlPath: string,
  sessionId: string,
): {
  cwd: string
  startedAt: number
  gitBranch?: string
  version?: string
  messageCount: number
  displayName: string
} {
  let cwd = ''
  let startedAt = 0
  let gitBranch: string | undefined
  let version: string | undefined
  let messageCount = 0
  let displayName = ''

  try {
    // Read first 50KB to get header info without reading entire file
    const fd = Bun.file(jsonlPath)
    const chunk = readFileSync(jsonlPath, { encoding: 'utf-8' })
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (!line.trim()) continue
      messageCount++

      try {
        const entry = JSON.parse(line)

        if (!cwd && entry.cwd) cwd = entry.cwd
        if (!startedAt && entry.timestamp) {
          const ts = typeof entry.timestamp === 'string'
            ? new Date(entry.timestamp).getTime()
            : entry.timestamp
          if (!startedAt || ts < startedAt) startedAt = ts
        }
        if (!gitBranch && entry.gitBranch) gitBranch = entry.gitBranch
        if (!version && entry.version) version = entry.version

        // Get first user message as display name
        if (!displayName && entry.type === 'user' && entry.message?.content) {
          const content = entry.message.content
          if (typeof content === 'string') {
            displayName = content.slice(0, 80)
          } else if (Array.isArray(content)) {
            const textBlock = content.find((c: { type: string }) => c.type === 'text')
            if (textBlock?.text) {
              displayName = textBlock.text.slice(0, 80)
            }
          }
        }
      } catch {
        // Skip malformed lines
      }
    }

    // Try history index for better display name
    const historyName = findDisplayNameForSession(sessionId, cwd, startedAt)
    if (historyName) displayName = historyName

  } catch {
    // File read error
  }

  return { cwd, startedAt, gitBranch, version, messageCount, displayName: displayName || sessionId.slice(0, 8) }
}

function decodeProjectDir(dirName: string): string {
  // Convert "-Users-shaunie-Documents-Code-project" to "/Users/shaunie/Documents/Code/project"
  return dirName.replace(/^-/, '/').replace(/-/g, '/')
}

export function invalidateSessionCache(): void {
  lastDiscoveryTime = 0
  invalidateHistoryCache()
}
