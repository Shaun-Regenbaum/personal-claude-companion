import { useState, useMemo } from 'react'
import { FileText, Clock, ListChecks, Play, CheckCircle2, Circle, Pencil } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { usePlans, usePlanContent } from '../../hooks/usePlans.ts'
import { relativeTime, formatTimestamp } from '../../lib/format.ts'
import type { PlanSummary } from '../../lib/types.ts'
import type { TaskEvent, TaskInfo, PlanReference } from '../../lib/plan-linker.ts'

interface PlanViewerProps {
  sessionPlanNames: string[]
  initialPlan?: string | null
  tasks: TaskInfo[]
  taskEvents: TaskEvent[]
  planRefs: PlanReference[]
}

export function PlanViewer({ sessionPlanNames, initialPlan, tasks, taskEvents, planRefs }: PlanViewerProps) {
  const { plans, loading: plansLoading } = usePlans()
  const [selectedPlan, setSelectedPlan] = useState<string | null>(initialPlan ?? null)
  const { content, loading: contentLoading } = usePlanContent(selectedPlan)

  // Sort: session-referenced plans first, then by recency
  const sortedPlans = useMemo(() => {
    const sessionSet = new Set(sessionPlanNames)
    return [...plans].sort((a, b) => {
      const aSession = sessionSet.has(a.name) ? 1 : 0
      const bSession = sessionSet.has(b.name) ? 1 : 0
      if (aSession !== bSession) return bSession - aSession
      return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
    })
  }, [plans, sessionPlanNames])

  // Auto-select first session plan or initialPlan
  const effectivePlan = selectedPlan ?? (sessionPlanNames.length > 0 ? sessionPlanNames[0] : null)

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Plan list */}
      <div style={{
        width: 240,
        flexShrink: 0,
        borderRight: '1px solid var(--color-border)',
        overflowY: 'auto',
      }}>
        {/* Task progress (if session has tasks) */}
        <div className="pzl-card-title" style={{ padding: '12px 12px 8px' }}>
          Plans
        </div>

        {plansLoading ? (
          <div style={{ padding: 12, fontSize: 12, color: 'var(--color-text-muted)' }}>Loading...</div>
        ) : (
          sortedPlans.map((plan) => (
            <PlanListItem
              key={plan.name}
              plan={plan}
              isSelected={(effectivePlan ?? selectedPlan) === plan.name}
              isSessionPlan={sessionPlanNames.includes(plan.name)}
              onSelect={() => setSelectedPlan(plan.name)}
            />
          ))
        )}

        {/* Activity history */}
        {(taskEvents.length > 0 || planRefs.length > 0) && (
          <ActivityHistory tasks={tasks} taskEvents={taskEvents} planRefs={planRefs} />
        )}
      </div>

      {/* Plan content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {contentLoading ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading plan...</div>
        ) : effectivePlan && content ? (
          <div className="plan-markdown">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 200,
            color: 'var(--color-text-muted)',
            fontSize: 13,
          }}>
            {plans.length === 0 ? 'No plans found' : 'Select a plan to view'}
          </div>
        )}
      </div>
    </div>
  )
}

function PlanListItem({ plan, isSelected, isSessionPlan, onSelect }: {
  plan: PlanSummary
  isSelected: boolean
  isSessionPlan: boolean
  onSelect: () => void
}) {
  const displayName = plan.name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  return (
    <div
      onClick={onSelect}
      style={{
        padding: '8px 12px',
        cursor: 'pointer',
        borderLeft: isSelected ? '2px solid var(--color-accent)' : '2px solid transparent',
        background: isSelected ? 'var(--color-bg-secondary)' : 'transparent',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'var(--color-bg-tertiary)'
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'transparent'
      }}
    >
      <FileText size={13} style={{
        color: isSessionPlan ? '#859900' : 'var(--color-text-muted)',
        marginTop: 2,
        flexShrink: 0,
      }} strokeWidth={2} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {displayName}
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 2,
        }}>
          <Clock size={10} style={{ color: 'var(--color-text-muted)' }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--color-text-muted)',
          }}>
            {relativeTime(new Date(plan.modifiedAt).getTime())}
          </span>
          {isSessionPlan && (
            <span style={{
              fontSize: 9,
              fontWeight: 600,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
              color: '#859900',
              background: '#85990015',
              padding: '1px 5px',
              borderRadius: 2,
            }}>
              This session
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function ActivityHistory({ tasks, taskEvents, planRefs }: {
  tasks: TaskInfo[]
  taskEvents: TaskEvent[]
  planRefs: PlanReference[]
}) {
  // Merge plan refs and task events into a single timeline, sorted chronologically
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
    <div style={{ borderTop: '1px solid var(--color-border)', padding: '8px 0' }}>
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
