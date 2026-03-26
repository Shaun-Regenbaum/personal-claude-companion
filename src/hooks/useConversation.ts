import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../lib/api.ts'
import type { ConversationMessage } from '../lib/types.ts'

export function useConversation(sessionId: string | null) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    if (!sessionId) {
      setMessages([])
      setTotal(0)
      return
    }

    try {
      // Load all messages — files are a few MB max, browser handles it fine
      const data = await api.getConversation(sessionId, { limit: 50000 })
      setMessages(data.messages)
      setTotal(data.total)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load conversation')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    setLoading(true)
    load()

    if (sessionId) {
      intervalRef.current = setInterval(load, 3000)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [load, sessionId])

  return { messages, total, loading, error, refresh: load }
}
