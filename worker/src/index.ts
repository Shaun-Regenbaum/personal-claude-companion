interface Env {
  AI: Ai
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, CF-Access-Client-Id, CF-Access-Client-Secret',
}

const MODEL = '@cf/moonshotai/kimi-k2.5'

interface Turn {
  prompt: string
  response: string
  tools: string
}

interface SummarySection {
  title: string
  summary: string
  decisions: string[]
  solved: string[]
  openQuestions: string[]
}

async function handleTitle(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as { turns: Turn[] }

    if (!body.turns?.length) {
      return Response.json({ error: 'turns required' }, { status: 400, headers: CORS })
    }

    // Use first 10 + last 5 turns for context
    const turns = body.turns
    const selected = turns.length <= 15
      ? turns
      : [...turns.slice(0, 10), ...turns.slice(-5)]

    const turnLines = selected
      .map(
        (t, i) =>
          `Turn ${i + 1} [tools: ${t.tools}]:\nUser: ${t.prompt.slice(0, 300)}\nAssistant: ${t.response.slice(0, 300)}`
      )
      .join('\n\n')

    const result = await env.AI.run(MODEL, {
      messages: [
        {
          role: 'system',
          content: `Generate a short title (3-8 words) for this coding session. The title should describe the main work done, like "Fix Plans Tab Session Isolation" or "Add LaunchAgent Daemon Mode" or "Refactor Auth Middleware".

Return ONLY a JSON object: { "title": "Your Title Here" }
No markdown fences, no explanation.`,
        },
        { role: 'user', content: turnLines },
      ],
      max_tokens: 100,
    })

    const raw = result as Record<string, unknown>
    let text = ''
    if (typeof raw.response === 'string') text = raw.response
    else if (typeof raw.result === 'string') text = raw.result
    else if (raw.choices && Array.isArray(raw.choices)) {
      const choice = (raw.choices as Array<{ message?: { content?: string } }>)[0]
      text = choice?.message?.content ?? ''
    } else {
      text = JSON.stringify(raw)
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      // Fall back to using the raw text as the title
      const cleaned = text.replace(/["\n]/g, '').trim().slice(0, 80)
      return Response.json({ title: cleaned || 'Untitled Session' }, { headers: CORS })
    }

    const parsed = JSON.parse(jsonMatch[0]) as { title: string }
    return Response.json({ title: String(parsed.title ?? 'Untitled Session').slice(0, 80) }, { headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 500, headers: CORS })
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS })
    }

    if (request.method !== 'POST') {
      return Response.json({ error: 'POST only' }, { status: 405, headers: CORS })
    }

    // Rate limiting
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown'
    const now = Date.now()
    const rl = rateLimitMap.get(ip)
    if (rl && now < rl.resetAt && rl.count >= 20) {
      return Response.json({ error: 'Rate limited' }, { status: 429, headers: CORS })
    }
    rateLimitMap.set(ip, {
      count: (rl && now < rl.resetAt ? rl.count : 0) + 1,
      resetAt: now + 60_000,
    })

    const url = new URL(request.url)
    if (url.pathname === '/title') {
      return handleTitle(request, env)
    }

    try {
      const body = (await request.json()) as { turns: Turn[] }

      if (!body.turns?.length) {
        return Response.json({ error: 'turns required' }, { status: 400, headers: CORS })
      }

      // Take last 30 turns to stay within context limits
      const MAX_TURNS = 30
      const recentTurns = body.turns.slice(-MAX_TURNS)

      const turnLines = recentTurns
        .map(
          (t, i) =>
            `Turn ${i + 1} [tools: ${t.tools}]:\nUser: ${t.prompt.slice(0, 500)}\nAssistant: ${t.response.slice(0, 500)}`
        )
        .join('\n\n')

      const result = await env.AI.run(MODEL, {
        messages: [
          {
            role: 'system',
            content: `You summarize coding sessions between a user and an AI coding assistant. You will receive a series of conversation turns.

Analyze the work done and group it into broad sections of related changes. Each section should represent a coherent area of work (e.g. "Timeline Markdown Rendering", "Test Suite Setup", "Hook Migration").

Return a JSON object with:
{
  "sections": [
    {
      "title": "Section title describing the area of work",
      "summary": "2-3 sentence narrative of what happened in this area",
      "decisions": ["Key decision 1", "Key decision 2"],
      "solved": ["Problem that was solved 1", "Problem that was solved 2"],
      "openQuestions": ["Remaining question 1"]
    }
  ]
}

Guidelines:
- Use broad sections, not one per turn. Group related turns together.
- Be specific about what was done, not generic.
- Decisions should capture WHY something was chosen.
- Solved should describe problems that were encountered and fixed.
- Open questions are things that remain unresolved or need follow-up.
- Keep it concise. 3-7 sections is typical for a long session.

Reply ONLY with valid JSON. No markdown fences, no explanation.`,
          },
          { role: 'user', content: turnLines },
        ],
        max_tokens: 4000,
      })

      const raw = result as Record<string, unknown>

      // Debug: capture the raw response structure
      const debugKeys = Object.keys(raw)

      // Extract text from various possible response formats
      let text = ''
      if (typeof raw.response === 'string') {
        text = raw.response
      } else if (typeof raw.result === 'string') {
        text = raw.result
      } else if (raw.choices && Array.isArray(raw.choices)) {
        const choice = (raw.choices as Array<{ message?: { content?: string } }>)[0]
        text = choice?.message?.content ?? ''
      } else {
        text = JSON.stringify(raw)
      }

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return Response.json(
          { error: 'Failed to parse model response', debug: { keys: debugKeys, text: text.slice(0, 500) } },
          { status: 500, headers: CORS }
        )
      }

      const parsed = JSON.parse(jsonMatch[0]) as { sections: SummarySection[] }

      // Validate and sanitize sections
      const sections: SummarySection[] = Array.isArray(parsed.sections)
        ? parsed.sections.map((s) => ({
            title: String(s.title ?? '').slice(0, 120),
            summary: String(s.summary ?? '').slice(0, 1000),
            decisions: Array.isArray(s.decisions)
              ? s.decisions.map((d: unknown) => String(d ?? '').slice(0, 300))
              : [],
            solved: Array.isArray(s.solved)
              ? s.solved.map((d: unknown) => String(d ?? '').slice(0, 300))
              : [],
            openQuestions: Array.isArray(s.openQuestions)
              ? s.openQuestions.map((d: unknown) => String(d ?? '').slice(0, 300))
              : [],
          }))
        : []

      return Response.json({ sections }, { headers: CORS })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return Response.json({ error: message }, { status: 500, headers: CORS })
    }
  },
}
