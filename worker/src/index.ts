interface Env {
  AI: Ai
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS })
    if (request.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405, headers: CORS })

    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
    const now = Date.now()
    const rl = rateLimitMap.get(ip)
    if (rl && now < rl.resetAt && rl.count >= 20) {
      return Response.json({ error: 'Rate limited' }, { status: 429, headers: CORS })
    }
    rateLimitMap.set(ip, { count: (rl && now < rl.resetAt ? rl.count : 0) + 1, resetAt: now + 60_000 })

    try {
      const body = await request.json() as {
        turns: Array<{ prompt: string; response: string; tools: string }>
      }

      if (!body.turns?.length) {
        return Response.json({ error: 'turns required' }, { status: 400, headers: CORS })
      }

      // Build the full context for the model
      const turnLines = body.turns.map((t, i) =>
        `--- Turn ${i + 1} ---\nUser: ${t.prompt}\nAssistant: ${t.response}\nTools: ${t.tools}`
      ).join('\n\n')

      const result = await env.AI.run(MODEL, {
        messages: [
          {
            role: 'system',
            content: `You summarize coding sessions. You will receive a series of conversation turns between a user and an AI coding assistant.

Return a JSON object with:
1. "title" - casual 3-6 word title for the overall session (what was the main thing worked on)
2. "description" - one casual sentence about what was accomplished
3. "turnTitles" - an array with one short casual title (3-7 words) per turn, describing what happened in that turn. Be specific about the actual work, not generic.

Style: casual, like telling a friend what you did. Examples: "Debugging the SSE connection", "Setting up the worker", "Fixing that auth bug".

Reply ONLY with valid JSON, no other text.`,
          },
          { role: 'user', content: turnLines },
        ],
        max_tokens: 2000,
      })

      const raw = result as Record<string, unknown>
      const text = typeof raw.response === 'string' ? raw.response : JSON.stringify(raw.response ?? '')

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return Response.json({ error: 'Failed to parse model response' }, { status: 500, headers: CORS })
      }

      const parsed = JSON.parse(jsonMatch[0])
      return Response.json({
        title: String(parsed.title ?? '').slice(0, 80),
        description: String(parsed.description ?? '').slice(0, 150),
        turnTitles: Array.isArray(parsed.turnTitles)
          ? parsed.turnTitles.map((t: unknown) => String(t ?? '').slice(0, 80))
          : [],
      }, { headers: CORS })
    } catch (e) {
      return Response.json(
        { error: e instanceof Error ? e.message : 'Unknown error' },
        { status: 500, headers: CORS }
      )
    }
  },
} satisfies ExportedHandler<Env>
