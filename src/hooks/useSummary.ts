import { useState, useCallback, useEffect, useRef } from 'react'
import { api } from '../lib/api.ts'

export interface SummarySection {
  title: string
  summary: string
  decisions: string[]
  solved: string[]
  openQuestions: string[]
}

// Safety timeout: if generating state isn't resolved within 90s, clear it and retry
const GENERATING_TIMEOUT = 90_000

export function useSummary(sessionId: string | null) {
  const [sections, setSections] = useState<SummarySection[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetched, setFetched] = useState(false)
  const sessionRef = useRef(sessionId)
  const sectionsRef = useRef(sections)
  const generatingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  sectionsRef.current = sections

  // Reset when session changes
  useEffect(() => {
    if (sessionId !== sessionRef.current) {
      sessionRef.current = sessionId
      setSections([])
      setFetched(false)
      setGenerating(false)
      setError(null)
      if (generatingTimer.current) {
        clearTimeout(generatingTimer.current)
        generatingTimer.current = null
      }
    }
  }, [sessionId])

  // Safety timeout for generating state
  useEffect(() => {
    if (generating) {
      generatingTimer.current = setTimeout(() => {
        setGenerating(false)
        setError('Summary generation timed out')
      }, GENERATING_TIMEOUT)
    } else if (generatingTimer.current) {
      clearTimeout(generatingTimer.current)
      generatingTimer.current = null
    }
    return () => {
      if (generatingTimer.current) clearTimeout(generatingTimer.current)
    }
  }, [generating])

  const fetchSummary = useCallback(async () => {
    if (!sessionId) return
    // Only show full loading spinner if we have nothing cached
    if (sectionsRef.current.length === 0) setLoading(true)
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
  }, [sessionId])

  // Listen for SSE events with reconnection
  useEffect(() => {
    if (!sessionId) return

    let retries = 0
    const MAX_RETRIES = 5
    let evtSource: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      evtSource = new EventSource('/api/events')

      evtSource.addEventListener('generation-started', (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.sessionId === sessionId) {
            setGenerating(true)
            setError(null)
          }
        } catch {}
      })

      evtSource.addEventListener('summary-update', (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.sessionId === sessionId) {
            setGenerating(false)
            fetchSummary()
          }
        } catch {}
      })

      evtSource.addEventListener('generation-failed', (e) => {
        try {
          const data = JSON.parse(e.data)
          if (data.sessionId === sessionId) {
            setGenerating(false)
            setLoading(false)
            setError(data.error ?? 'Summary generation failed')
          }
        } catch {}
      })

      evtSource.onerror = () => {
        evtSource?.close()
        if (retries < MAX_RETRIES) {
          retries++
          reconnectTimer = setTimeout(connect, 3000)
        }
      }

      // Reset retry count on successful connection
      evtSource.onopen = () => {
        retries = 0
      }
    }

    connect()

    return () => {
      evtSource?.close()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [sessionId, fetchSummary])

  return { sections, loading, generating, error, fetched, fetchSummary }
}
