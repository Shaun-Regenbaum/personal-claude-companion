import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const CACHE_PATH = join(homedir(), '.claude', 'companion-titles.json')
const TURN_CACHE_PATH = join(homedir(), '.claude', 'companion-turn-titles.json')

interface TitleEntry {
  title: string
  description: string
  generatedAt: string
  messageCount: number
}

// --- Session title cache ---

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

// --- Turn title cache ---

let turnCache: Map<string, string[]> | null = null

function loadTurnCache(): Map<string, string[]> {
  if (turnCache) return turnCache
  turnCache = new Map()
  try {
    if (existsSync(TURN_CACHE_PATH)) {
      const data = JSON.parse(readFileSync(TURN_CACHE_PATH, 'utf-8'))
      for (const [k, v] of Object.entries(data)) {
        turnCache.set(k, v as string[])
      }
    }
  } catch {
    turnCache = new Map()
  }
  return turnCache
}

function saveTurnCache(): void {
  const c = loadTurnCache()
  const obj: Record<string, string[]> = {}
  for (const [k, v] of c.entries()) {
    obj[k] = v
  }
  try {
    writeFileSync(TURN_CACHE_PATH, JSON.stringify(obj, null, 2))
  } catch {}
}

export function getCachedTurnTitles(sessionId: string): string[] | null {
  return loadTurnCache().get(sessionId) ?? null
}

export function setCachedTurnTitles(sessionId: string, titles: string[]): void {
  loadTurnCache().set(sessionId, titles)
  saveTurnCache()
}
