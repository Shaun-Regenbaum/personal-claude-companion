import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api.ts'
import type { PlanSummary } from '../lib/types.ts'

export function usePlans() {
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await api.getPlans()
      setPlans(data.plans)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { plans, loading, refresh }
}

export function usePlanContent(planName: string | null) {
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!planName) {
      setContent('')
      return
    }

    setLoading(true)
    api.getPlan(planName)
      .then((data) => setContent(data.content))
      .catch(() => setContent('Failed to load plan'))
      .finally(() => setLoading(false))
  }, [planName])

  return { content, loading }
}
