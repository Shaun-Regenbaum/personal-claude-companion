import { useState, useMemo, useEffect } from 'react'
import {
  ChevronDown, ChevronRight, User, Sparkles,
  Pencil, FileCode, BookOpen, TerminalSquare, Search,
  FolderSearch, Bot, Globe, Brain, ImageIcon,
  CheckCircle2, HelpCircle, Lightbulb, Loader2, AlertTriangle,
  List, Zap,
} from 'lucide-react'
import type { ConversationMessage } from '../../lib/types.ts'
import type { TurnGroup } from '../../lib/timeline-summarizer.ts'
import type { SummarySection } from '../../hooks/useSummary.ts'
import { useSummary } from '../../hooks/useSummary.ts'
import { formatTimestamp } from '../../lib/format.ts'
import { TimelineMessage } from './TimelineMessage.tsx'

interface SummaryViewProps {
  sessionId: string
  turns: TurnGroup[]
  messages: ConversationMessage[]
  toolResults: Map<string, string>
  onNavigateToTool?: (toolUseId: string) => void
}

const TOOL_ICONS: Record<string, { icon: typeof Pencil; color: string }> = {
  Edit: { icon: Pencil, color: '#859900' },
  Write: { icon: FileCode, color: '#859900' },
  Read: { icon: BookOpen, color: '#268bd2' },
  Bash: { icon: TerminalSquare, color: '#cb4b16' },
  Grep: { icon: Search, color: '#6c71c4' },
  Glob: { icon: FolderSearch, color: '#6c71c4' },
  Agent: { icon: Bot, color: '#b58900' },
  WebSearch: { icon: Globe, color: '#2aa198' },
}

export function SummaryView({ sessionId, turns, messages, toolResults, onNavigateToTool }: SummaryViewProps) {
  const [mode, setMode] = useState<'ai' | 'turns'>('ai')
  const { sections, loading, generating, error, fetched, fetchSummary } = useSummary(sessionId)

  // Auto-fetch AI summary when entering AI mode
  useEffect(() => {
    if (mode === 'ai' && !fetched && !loading) {
      fetchSummary()
    }
  }, [mode, fetched, loading, fetchSummary])

  return (
    <div style={{ padding: '4px 0' }}>
      {/* Mode toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '4px 24px',
        gap: 4,
      }}>
        <div className="pzl-tabs" style={{ padding: 2 }}>
          <button
            onClick={() => setMode('ai')}
            className={`pzl-tab ${mode === 'ai' ? 'pzl-tab-active' : ''}`}
            style={{ fontSize: 10, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Zap size={10} strokeWidth={2} /> AI Summary
          </button>
          <button
            onClick={() => setMode('turns')}
            className={`pzl-tab ${mode === 'turns' ? 'pzl-tab-active' : ''}`}
            style={{ fontSize: 10, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <List size={10} strokeWidth={2} /> Turns
          </button>
        </div>
      </div>

      {mode === 'ai' ? (
        <AISummaryView
          sections={sections}
          loading={loading}
          generating={generating}
          error={error}
          onRetry={fetchSummary}
        />
      ) : (
        <TurnsView
          turns={turns}
          messages={messages}
          toolResults={toolResults}
          onNavigateToTool={onNavigateToTool}
        />
      )}
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

// ---- Turns view (preserved from original) ----

function TurnsView({ turns, messages, toolResults, onNavigateToTool }: {
  turns: TurnGroup[]
  messages: ConversationMessage[]
  toolResults: Map<string, string>
  onNavigateToTool?: (toolUseId: string) => void
}) {
  const items: Array<
    | { type: 'turn'; turn: TurnGroup }
    | { type: 'compacted'; count: number }
  > = []
  let compactedCount = 0

  for (const turn of turns) {
    const isEmpty = turn.isCompaction ||
      (!turn.userPrompt && !turn.assistantPreview && turn.toolSummary.length === 0)

    if (isEmpty) {
      compactedCount++
    } else {
      if (compactedCount > 0) {
        items.push({ type: 'compacted', count: compactedCount })
        compactedCount = 0
      }
      items.push({ type: 'turn', turn })
    }
  }
  if (compactedCount > 0) items.push({ type: 'compacted', count: compactedCount })

  return (
    <>
      {items.map((item, i) => {
        if (item.type === 'compacted') {
          return (
            <div key={`c-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 24px' }}>
              <div style={{ flex: 1, height: 1, background: '#b5890030' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#b58900', opacity: 0.6 }}>
                {item.count} compacted
              </span>
              <div style={{ flex: 1, height: 1, background: '#b5890030' }} />
            </div>
          )
        }
        return (
          <TurnRow
            key={item.turn.turnNumber}
            turn={item.turn}
            allMessages={messages}
            toolResults={toolResults}
            onNavigateToTool={onNavigateToTool}
          />
        )
      })}
    </>
  )
}

function TurnRow({ turn, allMessages, toolResults, onNavigateToTool }: {
  turn: TurnGroup
  allMessages: ConversationMessage[]
  toolResults: Map<string, string>
  onNavigateToTool?: (toolUseId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const expandedMessages = useMemo(() => {
    if (turn.messages.length > 0) return turn.messages
    if (!turn.userTimestamp || !turn.endTimestamp) return []
    const start = new Date(turn.userTimestamp).getTime()
    const end = new Date(turn.endTimestamp).getTime()
    return allMessages.filter((msg) => {
      const t = new Date(msg.timestamp).getTime()
      return t >= start && t <= end
    })
  }, [turn, allMessages])

  const messageCount = turn.messages.length > 0 ? turn.messages.length : (turn as { messageCount?: number }).messageCount ?? expandedMessages.length
  const title = turn.userPrompt || turn.assistantPreview || '...'

  return (
    <div style={{ borderBottom: '1px solid var(--color-border)' }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 24px', cursor: 'pointer' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-tertiary)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <span style={{ color: 'var(--color-text-muted)', marginTop: 2, flexShrink: 0 }}>
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>

        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
          color: 'var(--color-text-muted)', width: 40, flexShrink: 0, marginTop: 1,
        }}>
          {turn.userTimestamp ? formatTimestamp(turn.userTimestamp) : ''}
        </span>

        <User size={13} style={{ color: '#268bd2', flexShrink: 0, marginTop: 2 }} strokeWidth={2.2} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4,
          }}>
            {title}
          </div>

          {turn.assistantPreview && turn.userPrompt && (
            <div style={{
              fontSize: 11, color: 'var(--color-text-muted)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              lineHeight: 1.3, marginTop: 1, maxWidth: 400,
            }}>
              <Sparkles size={10} style={{ color: '#2aa198', verticalAlign: 'middle', marginRight: 3 }} strokeWidth={2} />
              {turn.assistantPreview}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            {turn.toolSummary.map(({ name, count }) => {
              const cfg = TOOL_ICONS[name] ?? { icon: TerminalSquare, color: 'var(--color-text-muted)' }
              const Icon = cfg.icon
              return (
                <span key={name} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
                  color: cfg.color, background: `${cfg.color}10`,
                  padding: '1px 6px', borderRadius: 2, border: `1px solid ${cfg.color}20`,
                }}>
                  <Icon size={10} strokeWidth={2} />
                  {name} {count > 1 && `x${count}`}
                </span>
              )
            })}

            {turn.hasThinking && (
              <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, color: 'var(--color-text-muted)' }}>
                <Brain size={10} strokeWidth={2} />
              </span>
            )}
            {turn.hasImages && (
              <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, color: '#6c71c4' }}>
                <ImageIcon size={10} strokeWidth={2} />
              </span>
            )}
          </div>
        </div>

        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-muted)', flexShrink: 0, marginTop: 2 }}>
          {messageCount}
        </span>
      </div>

      {expanded && (
        <div style={{ padding: '0 24px 12px', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-primary)' }}>
          {expandedMessages
            .filter((msg) => {
              if (msg.type === 'user') return msg.content.some((b) => b.type === 'text' && b.text.trim())
              return msg.type !== 'progress' && msg.type !== 'agent_progress'
            })
            .map((msg, mi) => (
              <TimelineMessage
                key={msg.uuid || `msg-${mi}`}
                message={msg}
                toolResults={toolResults}
                onNavigateToTool={onNavigateToTool}
              />
            ))
          }
        </div>
      )}
    </div>
  )
}
