import { FileText, CheckCircle, Pencil } from 'lucide-react'

interface PlanMarkerProps {
  planName: string
  action: 'write' | 'edit' | 'exit-plan-mode'
  onClickPlan: (planName: string) => void
}

export function PlanMarker({ planName, action, onClickPlan }: PlanMarkerProps) {
  const displayName = planName
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  const isExit = action === 'exit-plan-mode'
  const Icon = isExit ? CheckCircle : (action === 'edit' ? Pencil : FileText)
  const label = isExit ? 'Plan approved' : (action === 'edit' ? 'Plan updated' : 'Plan created')
  const color = isExit ? '#859900' : '#268bd2'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 0',
      margin: '4px 0',
    }}>
      <div style={{ flex: 1, height: 1, background: `${color}30` }} />
      <button
        onClick={() => onClickPlan(planName)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          background: `${color}10`,
          border: `1px solid ${color}30`,
          borderRadius: 3,
          padding: '3px 10px',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
        title={`View plan: ${displayName}`}
      >
        <Icon size={12} style={{ color }} strokeWidth={2} />
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 600,
          color,
          letterSpacing: '0.03em',
          textTransform: 'uppercase' as const,
        }}>
          {label}
        </span>
        <span style={{
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
        }}>
          {displayName}
        </span>
      </button>
      <div style={{ flex: 1, height: 1, background: `${color}30` }} />
    </div>
  )
}
