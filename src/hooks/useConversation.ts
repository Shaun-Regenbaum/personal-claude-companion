import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api.ts'
import type { ConversationMessage } from '../lib/types.ts'

export function useConversation(sessionId: string | null) {
  const [messages, setMessages] = useState<ConversationMessage[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!sessionId) {
      setMessages([])
      setTotal(0)
      return
    }

    setLoading(true)
    try {
      const data = await api.getConversation(sessionId, { limit: 500 })
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
    load()
  }, [load])

  return { messages, total, loading, error, refresh: load }
}
