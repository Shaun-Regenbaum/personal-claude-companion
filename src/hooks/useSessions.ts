import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api.ts'
import type { Session } from '../lib/types.ts'

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await api.getSessions({ limit: 200 })
      setSessions(data.sessions)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { sessions, loading, error, refresh }
}
