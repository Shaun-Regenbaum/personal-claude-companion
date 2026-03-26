import { useState, useEffect, useRef } from 'react'
import {
  ChevronDown, ChevronRight, User, Sparkles,
  Pencil, FileCode, BookOpen, TerminalSquare, Search,
  FolderSearch, Bot, Globe, Brain, ImageIcon
} from 'lucide-react'
import type { TurnGroup } from '../../lib/timeline-summarizer.ts'
import { formatTimestamp } from '../../lib/format.ts'
import { TimelineMessage } from './TimelineMessage.tsx'
import { api } from '../../lib/api.ts'

interface SummaryViewProps {
  turns: TurnGroup[]
  toolResults: Map<string, string>
  onNavigateToTool?: (toolUseId: string) => void
  sessionId: string
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

export function SummaryView({ turns, toolResults, onNavigateToTool, sessionId }: SummaryViewProps) {
  const [turnTitles, setTurnTitles] = useState<string[]>([])
  const fetchedFor = useRef('')

  useEffect(() => {
    if (!sessionId || fetchedFor.current === sessionId) return
    fetchedFor.current = sessionId

    api.summarizeSession(sessionId)
      .then((res) => {
        if (res.turnTitles?.length) setTurnTitles(res.turnTitles)
      })
      .catch(() => {})
  }, [sessionId])

  // Collapse consecutive compactions/empty turns
  const items: Array<
    | { type: 'turn'; turn: TurnGroup; turnIdx: number }
    | { type: 'compacted'; count: number }
  > = []
  let compactedCount = 0

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i]
    const isEmpty = turn.isCompaction ||
      (!turn.userPrompt && !turn.assistantPreview && turn.toolSummary.length === 0)

    if (isEmpty) {
      compactedCount++
    } else {
      if (compactedCount > 0) {
        items.push({ type: 'compacted', count: compactedCount })
        compactedCount = 0
      }
      items.push({ type: 'turn', turn, turnIdx: i })
    }
  }
  if (compactedCount > 0) items.push({ type: 'compacted', count: compactedCount })

  return (
    <div style={{ padding: '4px 0' }}>
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
            aiTitle={turnTitles[item.turnIdx] || ''}
            toolResults={toolResults}
            onNavigateToTool={onNavigateToTool}
          />
        )
      })}
    </div>
  )
}

function TurnRow({ turn, aiTitle, toolResults, onNavigateToTool }: {
  turn: TurnGroup
  aiTitle: string
  toolResults: Map<string, string>
  onNavigateToTool?: (toolUseId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const title = aiTitle || turn.userPrompt || turn.assistantPreview || '...'
  const subtitle = aiTitle && turn.userPrompt && aiTitle !== turn.userPrompt ? turn.userPrompt : null

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
          {/* Title */}
          <div style={{
            fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4,
          }}>
            {title}
          </div>

          {/* Original prompt as subtitle when AI title is shown */}
          {subtitle && (
            <div style={{
              fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              lineHeight: 1.3, marginTop: 1, maxWidth: 400,
            }}>
              {subtitle}
            </div>
          )}

          {/* Tool chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
            {!aiTitle && turn.assistantPreview && turn.userPrompt && (
              <span style={{
                fontSize: 11, color: 'var(--color-text-muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300,
              }}>
                <Sparkles size={10} style={{ color: '#2aa198', verticalAlign: 'middle', marginRight: 3 }} strokeWidth={2} />
                {turn.assistantPreview}
              </span>
            )}

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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, color: 'var(--color-text-muted)' }}>
                <Brain size={10} strokeWidth={2} />
              </span>
            )}
            {turn.hasImages && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, color: '#6c71c4' }}>
                <ImageIcon size={10} strokeWidth={2} />
              </span>
            )}
          </div>
        </div>

        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-muted)', flexShrink: 0, marginTop: 2 }}>
          {turn.messages.length}
        </span>
      </div>

      {expanded && (
        <div style={{ padding: '0 24px 12px', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-primary)' }}>
          {turn.messages
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
