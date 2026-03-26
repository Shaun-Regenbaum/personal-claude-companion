import { useState, useEffect } from 'react'
import {
  Circle, Loader, CheckCircle2, RotateCw, Pencil, FileText,
  ChevronDown, ChevronRight
} from 'lucide-react'
import { api } from '../../lib/api.ts'
import { relativeTime } from '../../lib/format.ts'
import type { TaskInfo } from '../../lib/plan-linker.ts'

interface ActivityBarProps {
  sessionId: string
  tasks: TaskInfo[]
}

interface ActivitySummary {
  turns: number
  fileChanges: number
  tasksDone: number
  planUpdates: number
  lastActivity: string | null
}

export function ActivityBar({ sessionId, tasks }: ActivityBarProps) {
  const [summary, setSummary] = useState<ActivitySummary | null>(null)
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    const load = () => {
      api.getActivitySummary(sessionId).then(setSummary).catch(() => {})
    }
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [sessionId])

  const completed = tasks.filter((t) => t.status === 'completed').length
  const hasTasks = tasks.length > 0
  const hasActivity = summary?.lastActivity

  if (!hasTasks && !hasActivity) return null

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 10,
      borderBottom: '1px solid var(--color-border)',
      background: 'var(--color-bg-secondary)',
    }}>
      {/* Stats row — always visible */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '5px 24px',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          cursor: hasTasks ? 'pointer' : 'default',
        }}
        onClick={() => hasTasks && setExpanded(!expanded)}
      >
        {hasTasks && (
          <span style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)' }}>
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}

        {hasTasks && (
          <Stat
            icon={<CheckCircle2 size={11} strokeWidth={2} />}
            value={`${completed}/${tasks.length}`}
            label="tasks"
            color={completed === tasks.length ? '#859900' : '#268bd2'}
          />
        )}

        {summary && hasActivity && (
          <>
            <Stat icon={<RotateCw size={11} strokeWidth={2} />} value={String(summary.turns)} label="turns" color="var(--color-accent)" />
            <Stat icon={<Pencil size={11} strokeWidth={2} />} value={String(summary.fileChanges)} label="edits" color="#859900" />
            {summary.planUpdates > 0 && (
              <Stat icon={<FileText size={11} strokeWidth={2} />} value={String(summary.planUpdates)} label="plans" color="#6c71c4" />
            )}
          </>
        )}

        {summary?.lastActivity && (
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-text-muted)' }}>
            {relativeTime(new Date(summary.lastActivity).getTime())}
          </span>
        )}
      </div>

      {/* Task list — expandable */}
      {hasTasks && expanded && (
        <div style={{
          padding: '0 24px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          {/* Progress bar */}
          <div style={{
            height: 2,
            background: 'var(--color-bg-tertiary)',
            borderRadius: 1,
            marginBottom: 4,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.round((completed / tasks.length) * 100)}%`,
              background: '#859900',
              transition: 'width 0.3s ease',
            }} />
          </div>

          {tasks.map((task, i) => {
            const Icon = task.status === 'completed' ? CheckCircle2
              : task.status === 'in_progress' ? Loader
              : Circle
            const color = task.status === 'completed' ? '#859900'
              : task.status === 'in_progress' ? '#b58900'
              : 'var(--color-text-muted)'

            return (
              <div key={task.taskId || i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
              }}>
                <Icon size={12} style={{
                  color,
                  flexShrink: 0,
                  ...(task.status === 'in_progress' ? { animation: 'spin 2s linear infinite' } : {}),
                }} strokeWidth={2} />
                <span style={{
                  fontWeight: 500,
                  color: task.status === 'completed' ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
                  textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {task.subject}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({ icon, value, label, color }: { icon: React.ReactNode; value: string; label: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color }}>
      {icon}
      <span style={{ fontWeight: 600 }}>{value}</span>
      <span style={{ fontWeight: 500, color: 'var(--color-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{label}</span>
    </span>
  )
}
