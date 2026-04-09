import { useState, useMemo, useCallback, useRef } from 'react'
import { FileText, ListChecks, Play, CheckCircle2, Pencil, X, Save, Hash } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { HighlightedCode } from '../timeline/HighlightedCode.tsx'
import { api } from '../../lib/api.ts'
import { usePlans, usePlanContent } from '../../hooks/usePlans.ts'
import { formatTimestamp } from '../../lib/format.ts'
import type { TaskEvent, PlanReference } from '../../lib/plan-linker.ts'

interface PlanViewerProps {
  sessionPlanNames: string[]
  initialPlan?: string | null
  taskEvents: TaskEvent[]
  planRefs: PlanReference[]
}

interface TocEntry {
  level: number
  text: string
  slug: string
}

function extractToc(markdown: string): TocEntry[] {
  const entries: TocEntry[] = []
  for (const line of markdown.split('\n')) {
    const match = line.match(/^(#{1,4})\s+(.+)/)
    if (match) {
      const text = match[2].replace(/[*_`\[\]]/g, '').trim()
      const slug = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      entries.push({ level: match[1].length, text, slug })
    }
  }
  return entries
}

export function PlanViewer({ sessionPlanNames, initialPlan, taskEvents, planRefs }: PlanViewerProps) {
  const { refresh: refreshPlans } = usePlans()
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Auto-select: initialPlan > first session plan
  const effectivePlan = initialPlan
    ?? (sessionPlanNames.length > 0 ? sessionPlanNames[0] : null)

  const { content, loading: contentLoading, refresh: refreshContent } = usePlanContent(effectivePlan)

  const toc = useMemo(() => content ? extractToc(content) : [], [content])

  const handleScrollToHeading = useCallback((slug: string) => {
    if (!contentRef.current) return
    const headings = contentRef.current.querySelectorAll('h1, h2, h3, h4')
    for (const h of headings) {
      const hSlug = (h.textContent ?? '').toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
      if (hSlug === slug) {
        h.scrollIntoView({ behavior: 'smooth', block: 'start' })
        break
      }
    }
  }, [])

  const handleStartEdit = useCallback(() => {
    setEditContent(content)
    setEditing(true)
  }, [content])

  const handleCancelEdit = useCallback(() => {
    setEditing(false)
    setEditContent('')
  }, [])

  const handleSave = useCallback(async () => {
    if (!effectivePlan) return
    setSaving(true)
    try {
      await api.updatePlan(effectivePlan, editContent)
      setEditing(false)
      refreshPlans()
      refreshContent()
    } catch {
      // keep editing on error
    } finally {
      setSaving(false)
    }
  }, [effectivePlan, editContent, refreshPlans])

  const hasHistory = taskEvents.length > 0 || planRefs.length > 0
  const hasSidebar = toc.length > 0 || hasHistory

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Sidebar: TOC + Activity history */}
      {hasSidebar && (
        <div style={{
          width: 240,
          flexShrink: 0,
          borderRight: '1px solid var(--color-border)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {toc.length > 0 && (
            <div style={{ padding: '6px 0' }}>
              <div className="pzl-card-title" style={{ padding: '2px 12px 4px', fontSize: 9 }}>
                Outline
              </div>
              {toc.map((entry, i) => (
                <div
                  key={i}
                  onClick={() => handleScrollToHeading(entry.slug)}
                  title={entry.text}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '2px 8px',
                    paddingLeft: 8 + (entry.level - 1) * 10,
                    cursor: 'pointer',
                    fontSize: 10,
                    lineHeight: 1.3,
                    fontWeight: entry.level <= 2 ? 600 : 400,
                    color: entry.level <= 2 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-tertiary)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <Hash size={8} style={{ color: 'var(--color-text-muted)', flexShrink: 0, opacity: 0.4 }} />
                  {entry.text}
                </div>
              ))}
            </div>
          )}

          {hasHistory && (
            <>
              {toc.length > 0 && <div style={{ borderTop: '1px solid var(--color-border)' }} />}
              <ActivityHistory taskEvents={taskEvents} planRefs={planRefs} />
            </>
          )}
        </div>
      )}

      {/* Plan content */}
      <div ref={contentRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column' }}>
        {/* Edit toolbar */}
        {effectivePlan && content && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 6,
            marginBottom: 8,
          }}>
            {editing ? (
              <>
                <button
                  onClick={handleCancelEdit}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 11, padding: '4px 10px',
                    background: 'var(--color-bg-tertiary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4, cursor: 'pointer',
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'inherit',
                  }}
                >
                  <X size={11} /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 11, padding: '4px 10px',
                    background: '#859900',
                    border: 'none',
                    borderRadius: 4, cursor: 'pointer',
                    color: '#fff',
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  <Save size={11} /> {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              <button
                onClick={handleStartEdit}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, padding: '4px 10px',
                  background: 'none',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4, cursor: 'pointer',
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'inherit',
                }}
              >
                <Pencil size={11} /> Edit
              </button>
            )}
          </div>
        )}

        {contentLoading ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading plan...</div>
        ) : effectivePlan && content ? (
          editing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              style={{
                flex: 1,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                lineHeight: 1.6,
                padding: 12,
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                resize: 'none',
                outline: 'none',
              }}
            />
          ) : (
            <div className="plan-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: HighlightedCode }}>{content}</ReactMarkdown>
            </div>
          )
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 200,
            color: 'var(--color-text-muted)',
            fontSize: 13,
          }}>
            No plan found for this session
          </div>
        )}
      </div>
    </div>
  )
}

function ActivityHistory({ taskEvents, planRefs }: {
  taskEvents: TaskEvent[]
  planRefs: PlanReference[]
}) {
  type HistoryEntry =
    | { type: 'plan'; ts: string; planName: string; action: string }
    | { type: 'task'; ts: string; taskId: string; event: string; subject: string }

  const entries: HistoryEntry[] = [
    ...planRefs.map((r) => ({
      type: 'plan' as const,
      ts: r.timestamp,
      planName: r.planName,
      action: r.action,
    })),
    ...taskEvents.map((e) => ({
      type: 'task' as const,
      ts: e.timestamp,
      taskId: e.taskId,
      event: e.event,
      subject: e.subject,
    })),
  ].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())

  if (entries.length === 0) return null

  const TASK_ICONS = {
    created: { icon: ListChecks, color: '#268bd2' },
    started: { icon: Play, color: '#b58900' },
    completed: { icon: CheckCircle2, color: '#859900' },
  }

  const PLAN_ICONS = {
    write: { icon: FileText, color: '#268bd2' },
    edit: { icon: Pencil, color: '#6c71c4' },
    'exit-plan-mode': { icon: CheckCircle2, color: '#859900' },
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <div className="pzl-card-title" style={{ padding: '4px 12px 6px' }}>
        History
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {entries.map((entry, i) => {
          if (entry.type === 'plan') {
            const cfg = PLAN_ICONS[entry.action as keyof typeof PLAN_ICONS] ?? PLAN_ICONS.write
            const Icon = cfg.icon
            const label = entry.action === 'write' ? 'Plan created'
              : entry.action === 'edit' ? 'Plan updated'
              : 'Plan approved'
            const displayName = entry.planName.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

            return (
              <div key={`plan-${i}`} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 12px',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
              }}>
                <span style={{ color: 'var(--color-text-muted)', width: 36, flexShrink: 0, textAlign: 'right' }}>
                  {formatTimestamp(entry.ts)}
                </span>
                <Icon size={11} style={{ color: cfg.color, flexShrink: 0 }} strokeWidth={2} />
                <span style={{ color: cfg.color, fontWeight: 600, flexShrink: 0 }}>{label}</span>
                <span style={{ color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayName}
                </span>
              </div>
            )
          }

          const cfg = TASK_ICONS[entry.event as keyof typeof TASK_ICONS] ?? TASK_ICONS.created
          const Icon = cfg.icon
          const label = entry.event === 'created' ? 'Task'
            : entry.event === 'started' ? 'Started'
            : 'Done'

          return (
            <div key={`task-${i}`} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 12px',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
            }}>
              <span style={{ color: 'var(--color-text-muted)', width: 36, flexShrink: 0, textAlign: 'right' }}>
                {formatTimestamp(entry.ts)}
              </span>
              <Icon size={11} style={{ color: cfg.color, flexShrink: 0 }} strokeWidth={2} />
              <span style={{ color: cfg.color, fontWeight: 600, flexShrink: 0 }}>{label}</span>
              <span style={{
                color: entry.event === 'completed' ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                textDecoration: entry.event === 'completed' ? 'line-through' : 'none',
              }}>
                {entry.subject}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
