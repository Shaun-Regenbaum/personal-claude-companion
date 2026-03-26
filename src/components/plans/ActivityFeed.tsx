import { useState, useEffect } from 'react'
import { Activity, FileText, CheckCircle2, RotateCw } from 'lucide-react'
import { api } from '../../lib/api.ts'
import { relativeTime } from '../../lib/format.ts'

interface ActivityFeedProps {
  sessionId: string | null
}

interface ActivitySummary {
  turns: number
  fileChanges: number
  tasksDone: number
  planUpdates: number
  lastActivity: string | null
}

export function ActivityFeed({ sessionId }: ActivityFeedProps) {
  const [summary, setSummary] = useState<ActivitySummary | null>(null)

  useEffect(() => {
    if (!sessionId) { setSummary(null); return }

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
      borderBottom: '1px solid var(--color-border)',
      padding: '10px 16px',
    }}>
      <div className="pzl-card-title" style={{ margin: 0, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
        <Activity size={11} strokeWidth={2} /> Live Activity
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <StatChip
          icon={<RotateCw size={11} strokeWidth={2} />}
          label="Turns"
          value={summary.turns}
          color="var(--color-accent)"
        />
        <StatChip
          icon={<FileText size={11} strokeWidth={2} />}
          label="Edits"
          value={summary.fileChanges}
          color="#859900"
        />
        <StatChip
          icon={<CheckCircle2 size={11} strokeWidth={2} />}
          label="Tasks"
          value={summary.tasksDone}
          color="#268bd2"
        />
      </div>

      {summary.lastActivity && (
        <div style={{
          marginTop: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--color-text-muted)',
        }}>
          Last activity {relativeTime(new Date(summary.lastActivity).getTime())}
        </div>
      )}
    </div>
  )
}

function StatChip({ icon, label, value, color }: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      fontWeight: 600,
      color,
    }}>
      {icon}
      <span>{value}</span>
      <span style={{ fontWeight: 500, color: 'var(--color-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  )
}
