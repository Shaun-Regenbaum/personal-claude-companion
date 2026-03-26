import { Circle, Loader, CheckCircle2 } from 'lucide-react'
import type { TaskInfo } from '../../lib/plan-linker.ts'

interface TaskProgressProps {
  tasks: TaskInfo[]
}

export function TaskProgress({ tasks }: TaskProgressProps) {
  if (tasks.length === 0) return null

  const completed = tasks.filter((t) => t.status === 'completed').length
  const total = tasks.length
  const pct = Math.round((completed / total) * 100)

  return (
    <div style={{
      borderBottom: '1px solid var(--color-border)',
      padding: '12px 16px',
    }}>
      {/* Header + progress bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span className="pzl-card-title" style={{ margin: 0 }}>Tasks</span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 600,
          color: completed === total ? '#859900' : 'var(--color-text-muted)',
        }}>
          {completed}/{total}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 3,
        background: 'var(--color-bg-tertiary)',
        borderRadius: 2,
        marginBottom: 10,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: '#859900',
          borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Task list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {tasks.map((task, i) => (
          <TaskRow key={task.taskId || i} task={task} />
        ))}
      </div>
    </div>
  )
}

function TaskRow({ task }: { task: TaskInfo }) {
  const Icon = task.status === 'completed' ? CheckCircle2
    : task.status === 'in_progress' ? Loader
    : Circle

  const color = task.status === 'completed' ? '#859900'
    : task.status === 'in_progress' ? '#b58900'
    : 'var(--color-text-muted)'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 6,
      padding: '2px 0',
    }}>
      <Icon size={13} style={{
        color,
        flexShrink: 0,
        marginTop: 1,
        ...(task.status === 'in_progress' ? { animation: 'spin 2s linear infinite' } : {}),
      }} strokeWidth={2} />
      <span style={{
        fontSize: 12,
        fontWeight: 500,
        color: task.status === 'completed' ? 'var(--color-text-muted)' : 'var(--color-text-primary)',
        textDecoration: task.status === 'completed' ? 'line-through' : 'none',
        lineHeight: 1.3,
      }}>
        {task.subject}
      </span>
    </div>
  )
}
