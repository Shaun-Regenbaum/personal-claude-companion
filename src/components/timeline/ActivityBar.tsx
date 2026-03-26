import { useState, useEffect } from 'react'
import {
  RotateCw, Pencil, FileText, Sparkles,
  ChevronDown, ChevronRight
} from 'lucide-react'
import { api } from '../../lib/api.ts'
import { relativeTime } from '../../lib/format.ts'

interface RecentTitle {
  sessionId: string
  title: string
  description: string
  generatedAt: string
}

interface ActivityBarProps {
  sessionId: string
  children?: React.ReactNode
}

interface ActivitySummary {
  turns: number
  fileChanges: number
  tasksDone: number
  planUpdates: number
  lastActivity: string | null
}

export function ActivityBar({ sessionId, children }: ActivityBarProps) {
  const [summary, setSummary] = useState<ActivitySummary | null>(null)
  const [recentTitles, setRecentTitles] = useState<RecentTitle[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const load = () => {
      api.getActivitySummary(sessionId).then(setSummary).catch(() => {})
    }
    load()
    const interval = setInterval(load, 5000)
    return () => clearInterval(interval)
  }, [sessionId])

  useEffect(() => {
    api.getRecentTitles(5).then((res) => setRecentTitles(res.titles)).catch(() => {})
  }, [sessionId])

  const hasActivity = summary?.lastActivity
  const hasTitles = recentTitles.length > 0

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 10,
      borderBottom: '1px solid var(--color-border)',
      background: 'var(--color-bg-secondary)',
    }}>
      {/* Stats row */}
      {hasActivity && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '5px 24px',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            cursor: hasTitles ? 'pointer' : 'default',
          }}
          onClick={() => hasTitles && setExpanded(!expanded)}
        >
          {hasTitles && (
            <span style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)' }}>
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          )}

          {summary && (
            <>
              <Stat icon={<RotateCw size={11} strokeWidth={2} />} value={String(summary.turns)} label="turns" color="var(--color-accent)" />
              <Stat icon={<Pencil size={11} strokeWidth={2} />} value={String(summary.fileChanges)} label="edits" color="#859900" />
              {summary.planUpdates > 0 && (
                <Stat icon={<FileText size={11} strokeWidth={2} />} value={String(summary.planUpdates)} label="plans" color="#6c71c4" />
              )}
            </>
          )}

          {hasTitles && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#6c71c4' }}>
              <Sparkles size={11} strokeWidth={2} />
              <span style={{ fontWeight: 600 }}>{recentTitles.length}</span>
              <span style={{ fontWeight: 500, color: 'var(--color-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>summaries</span>
            </span>
          )}

          {summary?.lastActivity && (
            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-text-muted)' }}>
              {relativeTime(new Date(summary.lastActivity).getTime())}
            </span>
          )}
        </div>
      )}

      {/* Recent AI summaries — expandable */}
      {hasTitles && expanded && (
        <div style={{
          padding: '0 24px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}>
          {recentTitles.map((t) => (
            <div key={t.sessionId} style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
            }}>
              <Sparkles size={10} style={{ color: '#6c71c4', flexShrink: 0, marginTop: 2 }} strokeWidth={2} />
              <div style={{ minWidth: 0 }}>
                <span style={{
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                }}>
                  {t.title}
                </span>
                {t.description && (
                  <span style={{
                    color: 'var(--color-text-muted)',
                    marginLeft: 6,
                  }}>
                    {t.description}
                  </span>
                )}
              </div>
              <span style={{
                marginLeft: 'auto',
                fontSize: 10,
                color: 'var(--color-text-muted)',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}>
                {relativeTime(new Date(t.generatedAt).getTime())}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Children (mode toggle) */}
      {children}
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
