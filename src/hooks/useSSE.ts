import { useEffect, useRef } from 'react'

type SSEHandler = (event: { type: string; sessionId?: string; timestamp: string }) => void

export function useSSE(handlers: Record<string, SSEHandler>) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    let evtSource: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let closed = false

    function connect() {
      if (closed) return
      evtSource = new EventSource('/api/events')

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
        evtSource?.close()
        evtSource = null
        // Reconnect after 3 seconds
        if (!closed) {
          reconnectTimer = setTimeout(connect, 3000)
        }
      }
    }

    connect()

    return () => {
      closed = true
      evtSource?.close()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [])
}
