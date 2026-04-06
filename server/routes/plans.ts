import { Hono } from 'hono'
import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs'
import { join } from 'path'

const PLANS_DIR = join(process.env.HOME ?? '', '.claude', 'plans')

const app = new Hono()

app.get('/', (c) => {
  try {
    const files = readdirSync(PLANS_DIR).filter((f) => f.endsWith('.md'))
    const plans = files
      .map((f) => {
        const path = join(PLANS_DIR, f)
        const stat = statSync(path)
        return {
          name: f.replace('.md', ''),
          path,
          modifiedAt: stat.mtime.toISOString(),
          sizeBytes: stat.size,
        }
      })
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())

    return c.json({ plans })
  } catch {
    return c.json({ plans: [] })
  }
})

app.get('/:name', (c) => {
  const name = c.req.param('name')
  const path = join(PLANS_DIR, `${name}.md`)

  try {
    const content = readFileSync(path, 'utf-8')
    const stat = statSync(path)
    return c.json({
      name,
      content,
      modifiedAt: stat.mtime.toISOString(),
    })
  } catch {
    return c.json({ error: 'Plan not found' }, 404)
  }
})

app.put('/:name', async (c) => {
  const name = c.req.param('name')

  // Validate plan name: alphanumeric, hyphens, underscores only
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return c.json({ error: 'Invalid plan name' }, 400)
  }

  const path = join(PLANS_DIR, `${name}.md`)

  try {
    const body = await c.req.json<{ content: string }>()
    if (typeof body.content !== 'string') {
      return c.json({ error: 'content required' }, 400)
    }

    writeFileSync(path, body.content, 'utf-8')
    const stat = statSync(path)
    return c.json({ name, modifiedAt: stat.mtime.toISOString() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return c.json({ error: message }, 500)
  }
})

export default app
