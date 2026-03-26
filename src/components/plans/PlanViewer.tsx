import { useState, useMemo } from 'react'
import { FileText, Clock } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { usePlans, usePlanContent } from '../../hooks/usePlans.ts'
import { relativeTime } from '../../lib/format.ts'
import type { PlanSummary } from '../../lib/types.ts'

interface PlanViewerProps {
  sessionPlanNames: string[]
  initialPlan?: string | null
}

export function PlanViewer({ sessionPlanNames, initialPlan }: PlanViewerProps) {
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
