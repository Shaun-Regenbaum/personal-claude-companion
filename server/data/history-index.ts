import { readFileSync } from 'fs'
import { join } from 'path'

const CLAUDE_DIR = join(process.env.HOME ?? '', '.claude')
const HISTORY_PATH = join(CLAUDE_DIR, 'history.jsonl')

interface HistoryEntry {
  display: string
  timestamp: number
  project?: string
  sessionId?: string
}

let cachedIndex: Map<string, { display: string; timestamp: number; project?: string }[]> | null = null
let cachedMtime: number = 0

export function getHistoryIndex(): Map<string, { display: string; timestamp: number; project?: string }[]> {
  try {
    const stat = Bun.file(HISTORY_PATH)
    // Re-parse if file changed (check size as proxy since we can't get mtime synchronously easily)
    if (cachedIndex) {
      return cachedIndex
    }

    const content = readFileSync(HISTORY_PATH, 'utf-8')
    const lines = content.trim().split('\n')
    const index = new Map<string, { display: string; timestamp: number; project?: string }[]>()

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const entry: HistoryEntry = JSON.parse(line)
        if (!entry.display || !entry.timestamp) continue

        // history.jsonl doesn't always have sessionId directly
        // We use project + timestamp to correlate later
        const key = entry.project ?? 'unknown'
        const existing = index.get(key) ?? []
        existing.push({
          display: entry.display,
          timestamp: entry.timestamp,
          project: entry.project,
        })
        index.set(key, existing)
      } catch {
        // Skip malformed lines
      }
    }

    cachedIndex = index
    return index
  } catch {
    return new Map()
  }
}

export function findDisplayNameForSession(
  sessionId: string,
  cwd: string,
  startedAt: number,
): string | null {
  const index = getHistoryIndex()

  // Try to find entries matching the project path and close to the session start time
  const projectEntries = index.get(cwd) ?? []
  const windowMs = 60_000 // 1 minute window

  // Find the first prompt that's close to the session start
  const match = projectEntries.find(
    (e) => Math.abs(e.timestamp - startedAt) < windowMs
  )

  if (match) {
    return match.display.slice(0, 80)
  }

  // Broader search: any project entry after session start
  const afterStart = projectEntries
    .filter((e) => e.timestamp >= startedAt - windowMs)
    .sort((a, b) => a.timestamp - b.timestamp)

  if (afterStart.length > 0) {
    return afterStart[0].display.slice(0, 80)
  }

  return null
}

export function invalidateHistoryCache(): void {
  cachedIndex = null
  cachedMtime = 0
}
