import { useState, useEffect } from 'react'
import { FileText, CheckCircle2, RotateCw, Pencil } from 'lucide-react'
import { api } from '../../lib/api.ts'
import { relativeTime } from '../../lib/format.ts'

interface ActivityBarProps {
  sessionId: string
}

interface ActivitySummary {
  turns: number
  fileChanges: number
  tasksDone: number
  planUpdates: number
  lastActivity: string | null
}

export function ActivityBar({ sessionId }: ActivityBarProps) {
  const [summary, setSummary] = useState<ActivitySummary | null>(null)

  useEffect(() => {
    const load = () => {
      api.getActivitySummary(sessionId).then(setSummary).catch(() => {})
    }
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [sessionId])

  if (!summary || !summary.lastActivity) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '6px 24px',
      borderBottom: '1px solid var(--color-border)',
      background: 'var(--color-bg-secondary)',
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
    }}>
      <Stat icon={<RotateCw size={11} strokeWidth={2} />} value={summary.turns} label="turns" color="var(--color-accent)" />
      <Stat icon={<Pencil size={11} strokeWidth={2} />} value={summary.fileChanges} label="edits" color="#859900" />
      <Stat icon={<CheckCircle2 size={11} strokeWidth={2} />} value={summary.tasksDone} label="tasks" color="#268bd2" />
      {summary.planUpdates > 0 && (
        <Stat icon={<FileText size={11} strokeWidth={2} />} value={summary.planUpdates} label="plan updates" color="#6c71c4" />
      )}
      <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-text-muted)' }}>
        {relativeTime(new Date(summary.lastActivity).getTime())}
      </span>
    </div>
  )
}

function Stat({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color }}>
      {icon}
      <span style={{ fontWeight: 600 }}>{value}</span>
      <span style={{ fontWeight: 500, color: 'var(--color-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{label}</span>
    </span>
  )
}
