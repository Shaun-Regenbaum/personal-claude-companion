import { ListChecks, Play, CheckCircle2 } from 'lucide-react'
import type { TaskEvent } from '../../lib/plan-linker.ts'

interface TaskMarkerProps {
  event: TaskEvent
}

const EVENT_CONFIG = {
  created: { Icon: ListChecks, color: '#268bd2', label: 'Task created' },
  started: { Icon: Play, color: '#b58900', label: 'Task started' },
  completed: { Icon: CheckCircle2, color: '#859900', label: 'Task done' },
} as const

export function TaskMarker({ event }: TaskMarkerProps) {
  const { Icon, color, label } = EVENT_CONFIG[event.event]

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '2px 0 2px 74px',
    }}>
      <Icon size={12} style={{ color, flexShrink: 0 }} strokeWidth={2} />
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 600,
        color,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--color-text-secondary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {event.subject}
      </span>
    </div>
  )
}
