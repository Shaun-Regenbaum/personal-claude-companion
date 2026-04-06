import { useState, useEffect, useCallback, useRef } from 'react'
import type { ConversationMessage } from '../lib/types.ts'
import type { TurnGroup } from '../lib/timeline-summarizer.ts'
import { groupIntoTurns } from '../lib/timeline-summarizer.ts'

interface HookTurnData {
  turnNumber: number
  userPrompt: string
  userTimestamp: string
  endTimestamp: string
  assistantPreview: string
  toolCalls: { name: string; file: string | null }[]
  toolSummary: { name: string; count: number }[]
  hasThinking: boolean
  hasImages: boolean
  messageCount: number
}

function hookTurnToTurnGroup(ht: HookTurnData): TurnGroup {
  return {
    turnNumber: ht.turnNumber,
    userPrompt: ht.userPrompt,
    userTimestamp: ht.userTimestamp,
    endTimestamp: ht.endTimestamp,
    assistantPreview: ht.assistantPreview,
    toolCalls: ht.toolCalls.map((tc) => ({ name: tc.name, filePath: tc.file ?? undefined })),
    toolSummary: ht.toolSummary,
    hasThinking: ht.hasThinking,
    hasImages: ht.hasImages,
    isCompaction: false,
    messages: [],
  }
}

export function useTurns(sessionId: string, messages: ConversationMessage[]): {
  turns: TurnGroup[]
  source: 'hooks' | 'fallback'
} {
  const [hookTurns, setHookTurns] = useState<TurnGroup[] | null>(null)
  const sessionRef = useRef(sessionId)

  const fetchTurns = useCallback(async () => {
    try {
      const res = await fetch(`/api/activity/turns/${sessionId}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.source === 'hooks' && data.turns) {
        // Only update if still the same session
        if (sessionRef.current === sessionId) {
          setHookTurns(data.turns.map(hookTurnToTurnGroup))
        }
      } else {
        setHookTurns(null)
      }
    } catch {
      setHookTurns(null)
    }
  }, [sessionId])

  // Reset and fetch when session changes
  useEffect(() => {
    sessionRef.current = sessionId
    setHookTurns(null)
    fetchTurns()
  }, [sessionId, fetchTurns])

  // Listen for activity-update SSE events
  useEffect(() => {
    const evtSource = new EventSource('/api/events')

    evtSource.addEventListener('activity-update', () => {
      fetchTurns()
    })

    evtSource.onerror = () => {
      evtSource.close()
    }

    return () => evtSource.close()
  }, [fetchTurns])

  if (hookTurns && hookTurns.length > 0) {
    return { turns: hookTurns, source: 'hooks' }
  }

  // Fallback to client-side grouping
  return { turns: groupIntoTurns(messages), source: 'fallback' }
}
