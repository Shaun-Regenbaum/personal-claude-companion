import { useMemo, useState } from 'react'
import { List, Layers } from 'lucide-react'
import type { ConversationMessage } from '../../lib/types.ts'
import type { PlanReference, TaskEvent, TaskInfo } from '../../lib/plan-linker.ts'
import { groupIntoTurns } from '../../lib/timeline-summarizer.ts'
import { TimelineMessage } from './TimelineMessage.tsx'
import { PlanMarker } from './PlanMarker.tsx'
import { TaskMarker } from './TaskMarker.tsx'
import { SummaryView } from './SummaryView.tsx'

interface TimelineViewProps {
  sessionId: string
  messages: ConversationMessage[]
  loading: boolean
  planRefs: PlanReference[]
  taskEvents: TaskEvent[]
  tasks: TaskInfo[]
  onClickPlan: (planName: string) => void
  onNavigateToTool?: (toolUseId: string) => void
}

export function TimelineView({ sessionId, messages, loading, planRefs, taskEvents, tasks, onClickPlan, onNavigateToTool }: TimelineViewProps) {
  const [mode, setMode] = useState<'full' | 'summary'>('full')

  const toolResults = useMemo(() => {
    const map = new Map<string, string>()
    for (const msg of messages) {
      if (msg.type !== 'user') continue
      for (const block of msg.content) {
        if (block.type === 'tool_result' && block.tool_use_id) {
          const text = block.content
            .map((c) => (c.type === 'text' ? c.text : ''))
            .join('\n')
            .slice(0, 3000)
          map.set(block.tool_use_id, text)
        }
      }
    }
    return map
  }, [messages])

  const planRefsByUuid = useMemo(() => {
    const map = new Map<string, PlanReference>()
    for (const ref of planRefs) map.set(ref.messageUuid, ref)
    return map
  }, [planRefs])

  const taskEventsByUuid = useMemo(() => {
    const map = new Map<string, TaskEvent[]>()
    for (const evt of taskEvents) {
      const list = map.get(evt.messageUuid) ?? []
      list.push(evt)
      map.set(evt.messageUuid, list)
    }
    return map
  }, [taskEvents])

  const displayMessages = useMemo(() => {
    return messages.filter((msg) => {
      if (msg.type === 'user') {
        return msg.content.some((b) => b.type === 'text' && b.text.trim())
      }
      return true
    })
  }, [messages])

  const turns = useMemo(() => groupIntoTurns(messages), [messages])

  if (loading && messages.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 256,
        color: 'var(--color-text-muted)',
        fontSize: 13,
      }}>
        Loading conversation...
      </div>
    )
  }

  if (displayMessages.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 256,
        color: 'var(--color-text-muted)',
        fontSize: 13,
      }}>
        No messages in this session
      </div>
    )
  }

  return (
    <div style={{
      // GPU acceleration for smooth scrolling
      transform: 'translateZ(0)',
      willChange: 'transform',
    }}>
      {/* Mode toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 24px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg-secondary)',
        position: 'sticky',
        top: 0,
        zIndex: 9,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 500,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {mode === 'summary' ? `${turns.length} turns` : `${displayMessages.length} messages`}
        </span>

        <div className="pzl-tabs" style={{ padding: 2 }}>
          <button
            onClick={() => setMode('full')}
            className={`pzl-tab ${mode === 'full' ? 'pzl-tab-active' : ''}`}
            style={{ fontSize: 10, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <List size={11} strokeWidth={2} /> Full
          </button>
          <button
            onClick={() => setMode('summary')}
            className={`pzl-tab ${mode === 'summary' ? 'pzl-tab-active' : ''}`}
            style={{ fontSize: 10, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Layers size={11} strokeWidth={2} /> Summary
          </button>
        </div>
      </div>

      {/* Content */}
      {mode === 'summary' ? (
        <SummaryView turns={turns} toolResults={toolResults} onNavigateToTool={onNavigateToTool} sessionId={sessionId} />
      ) : (
        <div style={{ padding: '8px 24px 24px' }}>
          {displayMessages.map((msg, i) => {
            const planRef = planRefsByUuid.get(msg.uuid)
            const taskEvts = taskEventsByUuid.get(msg.uuid)
            return (
              <div key={msg.uuid || `msg-${i}`}>
                {planRef && (
                  <PlanMarker
                    planName={planRef.planName}
                    action={planRef.action}
                    onClickPlan={onClickPlan}
                  />
                )}
                {taskEvts?.map((evt, i) => (
                  <TaskMarker key={`task-${evt.taskId}-${i}`} event={evt} />
                ))}
                <TimelineMessage message={msg} toolResults={toolResults} onNavigateToTool={onNavigateToTool} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
