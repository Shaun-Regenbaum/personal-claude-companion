import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const CACHE_PATH = join(homedir(), '.claude', 'companion-titles.json')

interface TitleEntry {
  title: string
  description: string
  generatedAt: string
  messageCount: number
}

let cache: Map<string, TitleEntry> | null = null

function loadCache(): Map<string, TitleEntry> {
  if (cache) return cache
  cache = new Map()
  try {
    if (existsSync(CACHE_PATH)) {
      const data = JSON.parse(readFileSync(CACHE_PATH, 'utf-8'))
      for (const [k, v] of Object.entries(data)) {
        cache.set(k, v as TitleEntry)
      }
    }
  } catch {
    cache = new Map()
  }
  return cache
}

function saveCache(): void {
  const c = loadCache()
  const obj: Record<string, TitleEntry> = {}
  for (const [k, v] of c.entries()) {
    obj[k] = v
  }
  try {
    writeFileSync(CACHE_PATH, JSON.stringify(obj, null, 2))
  } catch {
    // Non-critical
  }
}

export function getCachedTitle(sessionId: string): TitleEntry | null {
  return loadCache().get(sessionId) ?? null
}

export function setCachedTitle(
  sessionId: string,
  title: string,
  description: string,
  messageCount: number,
): void {
  loadCache().set(sessionId, {
    title,
    description,
    generatedAt: new Date().toISOString(),
    messageCount,
  })
  saveCache()
}

export function getAllCachedTitles(): Record<string, TitleEntry> {
  const c = loadCache()
  const obj: Record<string, TitleEntry> = {}
  for (const [k, v] of c.entries()) {
    obj[k] = v
  }
  return obj
}

export function getRecentTitles(limit = 5): Array<{ sessionId: string } & TitleEntry> {
  const c = loadCache()
  return Array.from(c.entries())
    .map(([sessionId, entry]) => ({ sessionId, ...entry }))
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    .slice(0, limit)
}
