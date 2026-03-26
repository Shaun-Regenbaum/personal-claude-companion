const API_BASE = '/api'

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

export const api = {
  getSessions: (params?: { status?: string; limit?: number; offset?: number }) => {
    const search = new URLSearchParams()
    if (params?.status) search.set('status', params.status)
    if (params?.limit) search.set('limit', String(params.limit))
    if (params?.offset) search.set('offset', String(params.offset))
    const qs = search.toString()
    return fetchJson<{
      sessions: import('./types.ts').Session[]
      total: number
    }>(`/sessions${qs ? `?${qs}` : ''}`)
  },

  getSession: (sessionId: string) =>
    fetchJson<{ session: import('./types.ts').Session }>(`/sessions/${sessionId}`),

  getConversation: (sessionId: string, params?: { offset?: number; limit?: number; types?: string[] }) => {
    const search = new URLSearchParams()
    if (params?.offset) search.set('offset', String(params.offset))
    if (params?.limit) search.set('limit', String(params.limit))
    if (params?.types) search.set('types', params.types.join(','))
    const qs = search.toString()
    return fetchJson<{
      messages: import('./types.ts').ConversationMessage[]
      total: number
      hasMore: boolean
    }>(`/conversations/${sessionId}${qs ? `?${qs}` : ''}`)
  },

  getOperations: (sessionId: string) =>
    fetchJson<{
      operations: import('./types.ts').FileOperation[]
      commits: import('./types.ts').CommitInfo[]
    }>(`/conversations/${sessionId}/operations`),

  getPlans: () =>
    fetchJson<{ plans: import('./types.ts').PlanSummary[] }>('/plans'),

  getPlan: (name: string) =>
    fetchJson<{ name: string; content: string; modifiedAt: string }>(`/plans/${name}`),

  getConfig: () =>
    fetchJson<import('./types.ts').ConfigData>('/config'),

  getGitLog: (sessionId: string, limit = 8) =>
    fetchJson<{
      entries: Array<{
        hash: string
        shortHash: string
        message: string
        author: string
        date: string
        refs: string
        graph: string
      }>
      graph: string
    }>(`/git/${sessionId}/log?limit=${limit}`),

  getActivitySummary: (sessionId: string) =>
    fetchJson<{
      turns: number
      fileChanges: number
      tasksDone: number
      planUpdates: number
      lastActivity: string | null
    }>(`/activity/summary/${sessionId}`),

  summarizeSession: (sessionId: string) =>
    fetch(`${API_BASE}/sessions/${sessionId}/summarize`, { method: 'POST' })
      .then((r) => r.json()) as Promise<{
        title: string; description: string; turnTitles: string[];
        generatedAt?: string; error?: string
      }>,

  deleteSkill: (name: string) =>
    fetch(`${API_BASE}/config/skills/${name}`, { method: 'DELETE' }).then((r) => r.json()),

  deleteMcp: (name: string) =>
    fetch(`${API_BASE}/config/mcp/${name}`, { method: 'DELETE' }).then((r) => r.json()),

  deletePlugin: (name: string) =>
    fetch(`${API_BASE}/config/plugins/${encodeURIComponent(name)}`, { method: 'DELETE' }).then((r) => r.json()),

  deleteHook: (source: string, event: string, index: number) =>
    fetch(`${API_BASE}/config/hooks/${source}/${event}/${index}`, { method: 'DELETE' }).then((r) => r.json()),
}
