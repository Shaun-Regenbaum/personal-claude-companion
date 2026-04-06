import { useState, useCallback, useEffect, useRef } from 'react'
import { api } from '../lib/api.ts'

export interface SummarySection {
  title: string
  summary: string
  decisions: string[]
  solved: string[]
  openQuestions: string[]
}

export function useSummary(sessionId: string | null) {
  const [sections, setSections] = useState<SummarySection[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetched, setFetched] = useState(false)
  const sessionRef = useRef(sessionId)

  // Reset when session changes
  useEffect(() => {
    if (sessionId !== sessionRef.current) {
      sessionRef.current = sessionId
      setSections([])
      setFetched(false)
      setGenerating(false)
      setError(null)
    }
  }, [sessionId])

  const fetchSummary = useCallback(async () => {
    if (!sessionId) return
    // Only show full loading spinner if we have nothing cached
    if (sections.length === 0) setLoading(true)
    setError(null)
    try {
      const data = await api.getSummary(sessionId) as {
        sections?: SummarySection[]
        error?: string
        generating?: boolean
        cached?: boolean
        stale?: boolean
      }
      if (sessionRef.current !== sessionId) return

      if (data.error) {
        setError(data.error)
      } else if (data.generating && (!data.sections || data.sections.length === 0)) {
        setGenerating(true)
      } else {
        setSections(data.sections ?? [])
        setGenerating(data.stale ?? false)
      }
      setFetched(true)
    } catch (err) {
      if (sessionRef.current !== sessionId) return
      setError(err instanceof Error ? err.message : 'Failed to generate summary')
    } finally {
      setLoading(false)
    }
  }, [sessionId, sections.length])

  // Listen for summary-update SSE events to auto-refresh
  useEffect(() => {
    if (!sessionId) return

    const evtSource = new EventSource('/api/events')

    evtSource.addEventListener('summary-update', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.sessionId === sessionId) {
          setGenerating(false)
          // Refetch to get the fresh data
          fetchSummary()
        }
      } catch {}
    })

    evtSource.onerror = () => evtSource.close()
    return () => evtSource.close()
  }, [sessionId, fetchSummary])

  return { sections, loading, generating, error, fetched, fetchSummary }
}
