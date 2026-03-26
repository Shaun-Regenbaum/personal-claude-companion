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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS })
    }

    // Only accept POST to /summarize (or root for backwards compat)
    const url = new URL(request.url)
    if (request.method !== 'POST' || (url.pathname !== '/summarize' && url.pathname !== '/')) {
      return Response.json({ error: 'POST /summarize only' }, { status: 405, headers: CORS_HEADERS })
    }

    // Rate limiting
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
    if (!checkRateLimit(ip)) {
      return Response.json(
        { error: 'Rate limit exceeded. Max 30 requests/minute.' },
        { status: 429, headers: { ...CORS_HEADERS, 'Retry-After': '60' } }
      )
    }

    try {
      const { messages } = (await request.json()) as { messages: string[] }

      if (!messages?.length) {
        return Response.json({ error: 'messages required' }, { status: 400, headers: CORS_HEADERS })
      }

      // Take first 3 user messages, truncated, as context
      const context = messages
        .slice(0, 3)
        .map((m) => m.slice(0, 200))
        .join('\n---\n')

      const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content:
              'You summarize coding sessions. The first message gives project context. The later messages show the most recent work. Generate a short title (max 6 words) about what was DONE recently, and a one-sentence description of the recent accomplishments. Focus on the latest activity, not the project description. Reply ONLY in this exact JSON format: {"title":"...","description":"..."}',
          },
          {
            role: 'user',
            content: context,
          },
        ],
        max_tokens: 100,
      })

      // Parse the model's response
      const text = (result as { response: string }).response ?? ''
      const match = text.match(/\{[^}]+\}/)
      if (!match) {
        return Response.json(
          { title: messages[0].slice(0, 40), description: '' },
          { headers: CORS_HEADERS }
        )
      }

      const parsed = JSON.parse(match[0])
      return Response.json(
        {
          title: (parsed.title ?? '').slice(0, 60),
          description: (parsed.description ?? '').slice(0, 120),
        },
        { headers: CORS_HEADERS }
      )
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : 'Unknown error' },
        { status: 500, headers: CORS_HEADERS }
      )
    }
  },
} satisfies ExportedHandler<Env>
