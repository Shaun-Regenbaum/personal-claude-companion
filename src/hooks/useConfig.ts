import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api.ts'
import type { ConfigData } from '../lib/types.ts'

export function useConfig() {
  const [config, setConfig] = useState<ConfigData | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const data = await api.getConfig()
      setConfig(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { config, loading, refresh }
}
