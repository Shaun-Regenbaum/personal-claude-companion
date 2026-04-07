import { join } from 'path'
import { readdirSync, statSync, unlinkSync, readFileSync, writeFileSync } from 'fs'

const CLAUDE_DIR = join(process.env.HOME ?? '', '.claude')
const SUMMARIES_DIR = join(CLAUDE_DIR, 'companion-summaries')
const LOGS_DIR = join(CLAUDE_DIR, 'companion-logs')
const ACTIVITY_PATH = join(CLAUDE_DIR, 'companion-activity.jsonl')

const BUDGET_BYTES = 200 * 1024 * 1024 // 200MB
const LOG_MAX_LINES = 10_000
const ACTIVITY_MAX_LINES = 50_000
const CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

function dirSize(dir: string): number {
  try {
    return readdirSync(dir).reduce((total, file) => {
      try { return total + statSync(join(dir, file)).size } catch { return total }
    }, 0)
  } catch { return 0 }
}

function fileSize(path: string): number {
  try { return statSync(path).size } catch { return 0 }
}

function totalSize(): number {
  return dirSize(SUMMARIES_DIR) + dirSize(LOGS_DIR) + fileSize(ACTIVITY_PATH)
}

function evictOldestSummaries(): boolean {
  try {
    const files = readdirSync(SUMMARIES_DIR)
      .map(f => ({ name: f, mtime: statSync(join(SUMMARIES_DIR, f)).mtimeMs }))
      .sort((a, b) => a.mtime - b.mtime)

    if (files.length === 0) return false

    const target = files[0]
    unlinkSync(join(SUMMARIES_DIR, target.name))
    console.log(`[storage-budget] evicted summary: ${target.name}`)
    return true
  } catch { return false }
}

function truncateFile(path: string, maxLines: number, label: string): boolean {
  try {
    const content = readFileSync(path, 'utf-8')
    const lines = content.split('\n')
    if (lines.length <= maxLines) return false

    const truncated = lines.slice(-maxLines).join('\n')
    writeFileSync(path, truncated)
    console.log(`[storage-budget] truncated ${label} from ${lines.length} to ${maxLines} lines`)
    return true
  } catch { return false }
}

function enforce() {
  let size = totalSize()
  if (size <= BUDGET_BYTES) return

  console.log(`[storage-budget] over budget: ${(size / 1024 / 1024).toFixed(1)}MB / ${BUDGET_BYTES / 1024 / 1024}MB`)

  // Priority 1: evict oldest summaries
  while (totalSize() > BUDGET_BYTES && evictOldestSummaries()) {}

  // Priority 2: truncate logs
  if (totalSize() > BUDGET_BYTES) {
    for (const file of ['stdout.log', 'stderr.log']) {
      truncateFile(join(LOGS_DIR, file), LOG_MAX_LINES, file)
    }
  }

  // Priority 3: truncate activity log
  if (totalSize() > BUDGET_BYTES) {
    truncateFile(ACTIVITY_PATH, ACTIVITY_MAX_LINES, 'companion-activity.jsonl')
  }

  size = totalSize()
  console.log(`[storage-budget] after cleanup: ${(size / 1024 / 1024).toFixed(1)}MB`)
}

export function startStorageBudget() {
  enforce()
  setInterval(enforce, CHECK_INTERVAL_MS)
}
