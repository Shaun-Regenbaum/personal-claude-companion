import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const CACHE_PATH = join(homedir(), '.claude', 'companion-summaries.json')

export interface SessionSummary {
  title: string
  description: string
  turnTitles: string[]
  generatedAt: string
}

let cache: Record<string, SessionSummary> | null = null

function load(): Record<string, SessionSummary> {
  if (cache) return cache
  try {
    if (existsSync(CACHE_PATH)) {
      cache = JSON.parse(readFileSync(CACHE_PATH, 'utf-8'))
      return cache!
    }
  } catch {}
  cache = {}
  return cache
}

function save(): void {
  try {
    writeFileSync(CACHE_PATH, JSON.stringify(load(), null, 2))
  } catch {}
}

export function getCached(sessionId: string): SessionSummary | null {
  return load()[sessionId] ?? null
}

export function setCached(sessionId: string, summary: SessionSummary): void {
  load()[sessionId] = summary
  save()
}
