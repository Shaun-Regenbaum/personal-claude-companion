import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { relativeTime, relativeTimeShort, formatTimestamp, truncate, groupByDay } from '../format'

describe('truncate', () => {
  it('returns short text unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('returns text at exact max length unchanged', () => {
    expect(truncate('hello', 5)).toBe('hello')
  })

  it('truncates with ellipsis', () => {
    expect(truncate('hello world', 6)).toBe('hello\u2026')
  })

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('')
  })
})

describe('formatTimestamp', () => {
  it('formats ISO string to HH:MM', () => {
    const result = formatTimestamp('2026-03-27T09:05:00Z')
    // The exact output depends on the local timezone, but it should be HH:MM format
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })
})

describe('relativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-27T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "just now" for < 60 seconds', () => {
    expect(relativeTime(Date.now() - 30_000)).toBe('just now')
  })

  it('returns minutes for < 60 minutes', () => {
    expect(relativeTime(Date.now() - 5 * 60_000)).toBe('5m ago')
  })

  it('returns hours for < 24 hours', () => {
    expect(relativeTime(Date.now() - 3 * 3_600_000)).toBe('3h ago')
  })

  it('returns days for < 7 days', () => {
    expect(relativeTime(Date.now() - 2 * 86_400_000)).toBe('2d ago')
  })

  it('returns date string for >= 7 days', () => {
    const result = relativeTime(Date.now() - 10 * 86_400_000)
    // Should be a locale date string, not "Xd ago"
    expect(result).not.toContain('ago')
  })
})

describe('relativeTimeShort', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-27T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "now" for < 1 minute', () => {
    expect(relativeTimeShort(Date.now() - 30_000)).toBe('now')
  })

  it('returns minutes', () => {
    expect(relativeTimeShort(Date.now() - 5 * 60_000)).toBe('5m')
  })

  it('returns hours', () => {
    expect(relativeTimeShort(Date.now() - 3 * 3_600_000)).toBe('3h')
  })

  it('returns days', () => {
    expect(relativeTimeShort(Date.now() - 2 * 86_400_000)).toBe('2d')
  })
})

describe('groupByDay', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-27T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const makeItem = (hoursAgo: number) => ({
    lastActivityAt: Date.now() - hoursAgo * 3_600_000,
  })

  it('returns empty map for empty input', () => {
    expect(groupByDay([]).size).toBe(0)
  })

  it('groups today items', () => {
    const items = [makeItem(1), makeItem(2)]
    const groups = groupByDay(items)
    expect(groups.get('Today')?.length).toBe(2)
  })

  it('groups yesterday items', () => {
    const items = [makeItem(30)] // 30 hours ago
    const groups = groupByDay(items)
    expect(groups.get('Yesterday')?.length).toBe(1)
  })

  it('groups this week items', () => {
    const items = [makeItem(72)] // 3 days ago
    const groups = groupByDay(items)
    expect(groups.get('This Week')?.length).toBe(1)
  })

  it('groups older items', () => {
    const items = [makeItem(24 * 10)] // 10 days ago
    const groups = groupByDay(items)
    expect(groups.get('Older')?.length).toBe(1)
  })

  it('separates mixed-age items into correct groups', () => {
    const items = [makeItem(1), makeItem(30), makeItem(72), makeItem(24 * 10)]
    const groups = groupByDay(items)
    expect(groups.get('Today')?.length).toBe(1)
    expect(groups.get('Yesterday')?.length).toBe(1)
    expect(groups.get('This Week')?.length).toBe(1)
    expect(groups.get('Older')?.length).toBe(1)
  })
})
