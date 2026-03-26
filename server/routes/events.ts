import { Hono } from 'hono'
import { subscribe } from '../watch/event-bus.ts'

const app = new Hono()

app.get('/', async (c) => {
  // Set SSE headers manually for better proxy compatibility
  c.header('Content-Type', 'text/event-stream')
  c.header('Cache-Control', 'no-cache')
  c.header('Connection', 'keep-alive')
  c.header('X-Accel-Buffering', 'no')

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      const send = (event: string, data: string) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`))
        } catch {
          // Stream closed
        }
      }

      // Send initial connection event
      send('connected', JSON.stringify({ timestamp: new Date().toISOString() }))

      // Subscribe to file watcher events
      const unsubscribe = subscribe((event) => {
        send(event.type, JSON.stringify(event))
      })

      // Keepalive every 15s (more frequent to prevent proxy timeout)
      const keepalive = setInterval(() => {
        send('keepalive', '')
      }, 15_000)

      // Cleanup on close
      c.req.raw.signal.addEventListener('abort', () => {
        unsubscribe()
        clearInterval(keepalive)
        try { controller.close() } catch { /* already closed */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
})

export default app
