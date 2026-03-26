import { useState, useEffect, useCallback } from 'react'
import { api } from '../lib/api.ts'
import type { FileOperation, CommitInfo } from '../lib/types.ts'

export function useOperations(sessionId: string | null) {
  const [operations, setOperations] = useState<FileOperation[]>([])
  const [commits, setCommits] = useState<CommitInfo[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!sessionId) {
      setOperations([])
      setCommits([])
      return
    }

    setLoading(true)
    try {
      const data = await api.getOperations(sessionId)
      setOperations(data.operations)
      setCommits(data.commits)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => { load() }, [load])

  return { operations, commits, loading, refresh: load }
}
