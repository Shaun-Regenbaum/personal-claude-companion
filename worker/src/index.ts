interface Env {
  AI: Ai
}

// Simple in-memory rate limiter: max 30 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (entry.count >= 30) return false
  entry.count++
  return true
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    if (request.method !== 'POST') {
      return Response.json({ error: 'POST only' }, { status: 405, headers: CORS_HEADERS })
    }

    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
    if (!checkRateLimit(ip)) {
      return Response.json(
        { error: 'Rate limit exceeded. Max 30 requests/minute.' },
        { status: 429, headers: { ...CORS_HEADERS, 'Retry-After': '60' } }
      )
    }

    const url = new URL(request.url)

    try {
      if (url.pathname === '/summarize-turns') {
        return await handleTurns(request, env)
      }
      return await handleSession(request, env)
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : 'Unknown error' },
        { status: 500, headers: CORS_HEADERS }
      )
    }
  },
} satisfies ExportedHandler<Env>

// Summarize a session (title + description)
async function handleSession(request: Request, env: Env): Promise<Response> {
  const { messages } = (await request.json()) as { messages: string[] }

  if (!messages?.length) {
    return Response.json({ error: 'messages required' }, { status: 400, headers: CORS_HEADERS })
  }

  const context = messages.slice(0, 4).map((m) => m.slice(0, 200)).join('\n---\n')

  const result = await env.AI.run(MODEL, {
    messages: [
      {
        role: 'system',
        content:
          'Summarize this coding session casually. The first message is project context, the rest show recent work. Write a short casual title (max 6 words) about what was actually done, and a one-sentence description. Be specific about the actual work, not generic. Reply ONLY as JSON: {"title":"...","description":"..."}',
      },
      { role: 'user', content: context },
    ],
    max_tokens: 100,
  })

  const raw = result as Record<string, unknown>
  const text = typeof raw.response === 'string' ? raw.response : JSON.stringify(raw.response ?? '')
  const match = text.match(/\{[^}]+\}/)
  if (!match) {
    return Response.json({ title: messages[messages.length - 1].slice(0, 40), description: '' }, { headers: CORS_HEADERS })
  }

  const parsed = JSON.parse(match[0])
  return Response.json(
    {
      title: (parsed.title ?? '').slice(0, 60),
      description: (parsed.description ?? '').slice(0, 120),
    },
    { headers: CORS_HEADERS }
  )
}

// Summarize multiple turns in a session (batch)
async function handleTurns(request: Request, env: Env): Promise<Response> {
  const { turns } = (await request.json()) as {
    turns: Array<{ userPrompt: string; assistantPreview: string; tools: string[] }>
  }

  if (!turns?.length) {
    return Response.json({ error: 'turns required' }, { status: 400, headers: CORS_HEADERS })
  }

  // Take the last 40 turns (most recent activity)
  const recentTurns = turns.slice(-40)
  const skipped = turns.length - recentTurns.length

  // Build a numbered list of turns for the model
  const turnList = recentTurns
    .map((t, i) => {
      const parts = []
      if (t.userPrompt) parts.push(`User: ${t.userPrompt.slice(0, 100)}`)
      if (t.assistantPreview) parts.push(`Assistant: ${t.assistantPreview.slice(0, 80)}`)
      if (t.tools.length > 0) parts.push(`Tools: ${t.tools.join(', ')}`)
      return `${i + 1}. ${parts.join(' | ')}`
    })
    .join('\n')

  const result = await env.AI.run(MODEL, {
    messages: [
      {
        role: 'system',
        content:
          'You are summarizing turns in a coding conversation. For each numbered turn below, write a casual short title (3-6 words) describing what happened. Be specific and casual, like talking to a friend. Reply ONLY as a JSON array of strings, one title per turn. Example: ["Fixed the auth bug","Debugging SSE connection","Adding rate limits to worker"]',
      },
      { role: 'user', content: turnList },
    ],
    max_tokens: 1500,
  })

  const raw = result as Record<string, unknown>
  const text = typeof raw.response === 'string' ? raw.response : JSON.stringify(raw.response ?? '')
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) {
    // Fallback: return empty titles with padding
    const padding = Array(skipped).fill('')
    return Response.json({ titles: [...padding, ...recentTurns.map(() => '')] }, { headers: CORS_HEADERS })
  }

  try {
    const titles = JSON.parse(match[0]) as string[]
    const recentTitles = titles.map((t) => (typeof t === 'string' ? t.slice(0, 60) : ''))
    // Prepend empty strings for skipped (older) turns
    const padding = Array(skipped).fill('')
    return Response.json(
      { titles: [...padding, ...recentTitles] },
      { headers: CORS_HEADERS }
    )
  } catch {
    return Response.json({ titles: turns.map(() => '') }, { headers: CORS_HEADERS })
  }
}
