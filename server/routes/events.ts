import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { subscribe } from '../watch/event-bus.ts'

const app = new Hono()

app.get('/', async (c) => {
  return streamSSE(c, async (stream) => {
    const unsubscribe = subscribe((event) => {
      stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event),
      })
    })

    // Send keepalive every 30s
    const keepalive = setInterval(() => {
      stream.writeSSE({ event: 'keepalive', data: '' })
    }, 30_000)

    // Wait until the stream is closed
    stream.onAbort(() => {
      unsubscribe()
      clearInterval(keepalive)
    })

    // Keep the stream alive
    await new Promise(() => {})
  })
})

export default app
