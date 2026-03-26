import { useEffect, useRef } from 'react'

type SSEHandler = (event: { type: string; sessionId?: string; timestamp: string }) => void

export function useSSE(handlers: Record<string, SSEHandler>) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const evtSource = new EventSource('/api/events')

    const eventTypes = ['session-update', 'conversation-update', 'plan-update', 'config-update']

    for (const type of eventTypes) {
      evtSource.addEventListener(type, (e) => {
        try {
          const data = JSON.parse(e.data)
          handlersRef.current[type]?.(data)
        } catch {
          // Skip malformed events
        }
      })
    }

    evtSource.onerror = () => {
      // EventSource will auto-reconnect
    }

    return () => evtSource.close()
  }, [])
}
