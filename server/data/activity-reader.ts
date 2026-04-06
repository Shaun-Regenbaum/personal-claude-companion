import { readFileSync, existsSync, statSync } from 'fs'
import { join } from 'path'

const ACTIVITY_PATH = join(process.env.HOME ?? '', '.claude', 'companion-activity.jsonl')

export interface ActivityEvent {
  ts: string
  session: string
  event: 'plan-update' | 'file-change' | 'turn-complete' | 'task-done' | 'turn-summary' | 'turn-data'
  plan?: string
  file?: string
  tool?: string
  summary?: string
  // turn-data fields
  turnNumber?: number
  userPrompt?: string
  userTimestamp?: string
  endTimestamp?: string
  assistantPreview?: string
  toolCalls?: { name: string; file: string | null }[]
  toolSummary?: { name: string; count: number }[]
  hasThinking?: boolean
  hasImages?: boolean
  messageCount?: number
}

export interface HookTurnData {
  turnNumber: number
  userPrompt: string
  userTimestamp: string
  endTimestamp: string
  assistantPreview: string
  toolCalls: { name: string; file: string | null }[]
  toolSummary: { name: string; count: number }[]
  hasThinking: boolean
  hasImages: boolean
  messageCount: number
}

let cachedEvents: ActivityEvent[] = []
let cachedMtime = 0

export function getActivityEvents(sessionId?: string, since?: string): ActivityEvent[] {
  if (!existsSync(ACTIVITY_PATH)) return []

  try {
    const stat = statSync(ACTIVITY_PATH)
    if (stat.mtimeMs !== cachedMtime) {
      const content = readFileSync(ACTIVITY_PATH, 'utf-8')
      cachedEvents = content
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          try { return JSON.parse(line) }
          catch { return null }
        })
        .filter((e): e is ActivityEvent => e !== null)
      cachedMtime = stat.mtimeMs
    }
  } catch {
    return []
  }

  let result = cachedEvents

  if (sessionId) {
    result = result.filter((e) => e.session === sessionId)
  }

  if (since) {
    const sinceTime = new Date(since).getTime()
    result = result.filter((e) => new Date(e.ts).getTime() > sinceTime)
  }

  return result
}

export function getLatestPlanActivity(sessionId: string): { planName: string; lastUpdated: string } | null {
  const events = getActivityEvents(sessionId)
    .filter((e) => e.event === 'plan-update')
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())

  if (events.length === 0) return null
  return { planName: events[0].plan!, lastUpdated: events[0].ts }
}

export function getSessionActivitySummary(sessionId: string) {
  const events = getActivityEvents(sessionId)
  const turns = events.filter((e) => e.event === 'turn-complete').length
  const fileChanges = events.filter((e) => e.event === 'file-change').length
  const tasksDone = events.filter((e) => e.event === 'task-done').length
  const planUpdates = events.filter((e) => e.event === 'plan-update').length
  const lastActivity = events.length > 0 ? events[events.length - 1].ts : null

  return { turns, fileChanges, tasksDone, planUpdates, lastActivity }
}

export function getHookTurns(sessionId: string): HookTurnData[] | null {
  const events = getActivityEvents(sessionId)
    .filter((e) => e.event === 'turn-data')

  if (events.length === 0) return null

  return events
    .sort((a, b) => (a.turnNumber ?? 0) - (b.turnNumber ?? 0))
    .map((e) => ({
      turnNumber: e.turnNumber ?? 0,
      userPrompt: e.userPrompt ?? '',
      userTimestamp: e.userTimestamp ?? '',
      endTimestamp: e.endTimestamp ?? '',
      assistantPreview: e.assistantPreview ?? '',
      toolCalls: e.toolCalls ?? [],
      toolSummary: e.toolSummary ?? [],
      hasThinking: e.hasThinking ?? false,
      hasImages: e.hasImages ?? false,
      messageCount: e.messageCount ?? 0,
    }))
}

export function invalidateActivityCache(): void {
  cachedMtime = 0
}
