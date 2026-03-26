import { useMemo } from 'react'
import type { ConversationMessage } from '../../lib/types.ts'
import type { PlanReference, TaskEvent } from '../../lib/plan-linker.ts'
import { TimelineMessage } from './TimelineMessage.tsx'
import { PlanMarker } from './PlanMarker.tsx'
import { TaskMarker } from './TaskMarker.tsx'

interface TimelineViewProps {
  messages: ConversationMessage[]
  loading: boolean
  planRefs: PlanReference[]
  taskEvents: TaskEvent[]
  onClickPlan: (planName: string) => void
  onNavigateToTool?: (toolUseId: string) => void
}

export function TimelineView({ messages, loading, planRefs, taskEvents, onClickPlan, onNavigateToTool }: TimelineViewProps) {
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

  // Index plan refs and task events by message UUID
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
    <div style={{ padding: '8px 24px 24px' }}>
      {displayMessages.map((msg) => {
        const planRef = planRefsByUuid.get(msg.uuid)
        const taskEvts = taskEventsByUuid.get(msg.uuid)
        return (
          <div key={msg.uuid || msg.timestamp}>
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
  )
}
