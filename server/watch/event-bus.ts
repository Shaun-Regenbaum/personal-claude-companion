type EventHandler = (event: { type: string; sessionId?: string; timestamp: string; error?: string }) => void

const listeners = new Set<EventHandler>()

export function subscribe(handler: EventHandler): () => void {
  listeners.add(handler)
  return () => listeners.delete(handler)
}

export function emit(event: { type: string; sessionId?: string; timestamp: string; error?: string }): void {
  for (const handler of listeners) {
    try {
      handler(event)
    } catch {
      // Don't let one listener break others
    }
  }
}
