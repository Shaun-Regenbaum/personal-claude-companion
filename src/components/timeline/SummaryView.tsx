import { useEffect } from 'react'
import {
  CheckCircle2, HelpCircle, Lightbulb, Loader2, AlertTriangle,
} from 'lucide-react'
import type { SummarySection } from '../../hooks/useSummary.ts'
import { useSummary } from '../../hooks/useSummary.ts'

interface SummaryViewProps {
  sessionId: string
}

export function SummaryView({ sessionId }: SummaryViewProps) {
  const { sections, loading, generating, error, fetched, fetchSummary } = useSummary(sessionId)

  useEffect(() => {
    if (!fetched && !loading) {
      fetchSummary()
    }
  }, [fetched, loading, fetchSummary])

  return (
    <div style={{ padding: '4px 0' }}>
      <AISummaryView
        sections={sections}
        loading={loading}
        generating={generating}
        error={error}
        onRetry={fetchSummary}
      />
    </div>
  )
}

function AISummaryView({ sections, loading, generating, error, onRetry }: {
  sections: SummarySection[]
  loading: boolean
  generating: boolean
  error: string | null
  onRetry: () => void
}) {
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 200,
        gap: 12,
        color: 'var(--color-text-muted)',
      }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 12 }}>Generating summary...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 200,
        gap: 8,
        color: 'var(--color-text-muted)',
      }}>
        <AlertTriangle size={18} style={{ color: '#cb4b16' }} />
        <span style={{ fontSize: 12 }}>{error}</span>
        <button
          onClick={onRetry}
          style={{
            fontSize: 11,
            padding: '4px 12px',
            background: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            cursor: 'pointer',
            color: 'var(--color-text-primary)',
            fontFamily: 'inherit',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (sections.length === 0 && generating) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: 200,
        gap: 12,
        color: 'var(--color-text-muted)',
      }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 12 }}>Generating summary...</span>
      </div>
    )
  }

  if (sections.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 200,
        color: 'var(--color-text-muted)',
        fontSize: 12,
      }}>
        No summary available
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 24px 24px' }}>
      {generating && sections.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0 8px',
          fontSize: 11, color: 'var(--color-text-muted)',
        }}>
          <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
          Updating...
        </div>
      )}
      {sections.map((section, i) => (
        <SectionCard key={i} section={section} />
      ))}
    </div>
  )
}

function SectionCard({ section }: { section: SummarySection }) {
  return (
    <div style={{
      marginBottom: 16,
      padding: '12px 16px',
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border)',
      borderRadius: 6,
    }}>
      {/* Title */}
      <div style={{
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        marginBottom: 8,
      }}>
        {section.title}
      </div>

      {/* Narrative */}
      <div style={{
        fontSize: 12,
        lineHeight: 1.6,
        color: 'var(--color-text-secondary)',
        marginBottom: section.decisions.length + section.solved.length + section.openQuestions.length > 0 ? 10 : 0,
      }}>
        {section.summary}
      </div>

      {/* Decisions */}
      {section.decisions.length > 0 && (
        <DetailList
          icon={Lightbulb}
          iconColor="#b58900"
          label="Decisions"
          items={section.decisions}
        />
      )}

      {/* Solved */}
      {section.solved.length > 0 && (
        <DetailList
          icon={CheckCircle2}
          iconColor="#859900"
          label="Solved"
          items={section.solved}
        />
      )}

      {/* Open Questions */}
      {section.openQuestions.length > 0 && (
        <DetailList
          icon={HelpCircle}
          iconColor="#268bd2"
          label="Open"
          items={section.openQuestions}
        />
      )}
    </div>
  )
}

function DetailList({ icon: Icon, iconColor, label, items }: {
  icon: typeof CheckCircle2
  iconColor: string
  label: string
  items: string[]
}) {
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginBottom: 3,
      }}>
        <Icon size={11} style={{ color: iconColor }} strokeWidth={2} />
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.05em',
          color: iconColor,
        }}>
          {label}
        </span>
      </div>
      {items.map((item, i) => (
        <div key={i} style={{
          fontSize: 11,
          lineHeight: 1.5,
          color: 'var(--color-text-secondary)',
          paddingLeft: 16,
          position: 'relative',
        }}>
          <span style={{
            position: 'absolute',
            left: 4,
            color: 'var(--color-text-muted)',
          }}>-</span>
          {item}
        </div>
      ))}
    </div>
  )
}

