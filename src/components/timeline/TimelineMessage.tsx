import { useState, useRef } from 'react'
import { User, Sparkles, ChevronDown, ChevronRight, AlertCircle, Image as ImageIcon } from 'lucide-react'
import type { ConversationMessage, MessageContent } from '../../lib/types.ts'
import { ToolCallBlock } from './ToolCallBlock.tsx'
import { formatTimestamp } from '../../lib/format.ts'

interface TimelineMessageProps {
  message: ConversationMessage
  toolResults: Map<string, string>
}

export function TimelineMessage({ message, toolResults }: TimelineMessageProps) {
  const [textExpanded, setTextExpanded] = useState(false)

  if (message.type === 'file-history-snapshot') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 0',
        margin: '4px 0',
      }}>
        <div style={{ flex: 1, height: 1, background: '#b5890040' }} />
        <AlertCircle size={12} style={{ color: '#b58900' }} strokeWidth={2} />
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 600,
          color: '#b58900',
          letterSpacing: '0.05em',
          textTransform: 'uppercase' as const,
        }}>
          Compaction
        </span>
        <div style={{ flex: 1, height: 1, background: '#b5890040' }} />
      </div>
    )
  }

  if (message.type === 'system' || message.type === 'progress' || message.type === 'agent_progress') {
    return null
  }

  const isUser = message.type === 'user'
  const isAssistant = message.type === 'assistant'
  if (!isUser && !isAssistant) return null

  const textBlocks = message.content.filter((b): b is Extract<MessageContent, { type: 'text' }> =>
    b.type === 'text' && b.text.trim().length > 0
  )
  const toolBlocks = message.content.filter((b): b is Extract<MessageContent, { type: 'tool_use' }> =>
    b.type === 'tool_use'
  )
  const thinkingBlocks = message.content.filter((b): b is Extract<MessageContent, { type: 'thinking' }> =>
    b.type === 'thinking'
  )
  const imageBlocks = message.content.filter((b): b is Extract<MessageContent, { type: 'image' }> =>
    b.type === 'image'
  )

  const hasText = textBlocks.length > 0
  const fullText = textBlocks.map((b) => b.text).join('\n')
  const isLongText = fullText.length > 200

  return (
    <div style={{ margin: isUser ? '12px 0 0' : '0' }}>
      {/* Text content row */}
      {hasText && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '4px 0' }}>
          {/* Timestamp column */}
          <div style={{
            width: 48,
            flexShrink: 0,
            textAlign: 'right',
            paddingTop: 2,
          }}>
            {message.timestamp && (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--color-text-muted)',
              }}>
                {formatTimestamp(message.timestamp)}
              </span>
            )}
          </div>

          {/* Role icon */}
          <div style={{ flexShrink: 0, width: 18, paddingTop: 3 }}>
            {isUser
              ? <User size={14} style={{ color: '#268bd2' }} strokeWidth={2.2} />
              : <Sparkles size={14} style={{ color: '#2aa198' }} strokeWidth={2.2} />
            }
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                lineHeight: 1.6,
                color: 'var(--color-text-primary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: textExpanded ? 'none' : (isLongText ? 66 : 'none'),
                overflow: 'hidden',
              }}
            >
              {fullText}
            </div>
            {isLongText && (
              <button
                onClick={() => setTextExpanded(!textExpanded)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--color-accent)',
                  fontFamily: 'inherit',
                  padding: '2px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                {textExpanded
                  ? <><ChevronDown size={13} /> Show less</>
                  : <><ChevronRight size={13} /> Show more</>
                }
              </button>
            )}
          </div>
        </div>
      )}

      {/* Thinking (collapsed) */}
      {thinkingBlocks.map((block, i) => (
        <ThinkingRow key={`think-${i}`} text={block.thinking} />
      ))}

      {/* Images */}
      {imageBlocks.map((block, i) => (
        <div key={`img-${i}`} style={{ paddingLeft: 74, padding: '4px 0 4px 74px' }}>
          <ImagePreview
            data={block.source.data}
            mediaType={block.source.media_type}
          />
        </div>
      ))}

      {/* Tool calls */}
      {toolBlocks.map((block) => (
        <div key={block.id} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: 48,
            flexShrink: 0,
            textAlign: 'right',
            paddingRight: 8,
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--color-text-muted)',
            }}>
              {message.timestamp ? formatTimestamp(message.timestamp) : ''}
            </span>
          </div>
          <div style={{ flex: 1, paddingLeft: 18 }}>
            <ToolCallBlock
              name={block.name}
              input={block.input}
              result={toolResults.get(block.id)}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function ThinkingRow({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ paddingLeft: 74 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 500,
          color: 'var(--color-text-muted)',
          padding: '2px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 3,
        }}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        thinking...
      </button>
      {expanded && (
        <pre style={{
          fontFamily: 'var(--font-mono)',
          marginTop: 4,
          background: 'var(--color-bg-tertiary)',
          padding: 10,
          borderRadius: 4,
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)',
          whiteSpace: 'pre-wrap',
          maxHeight: 200,
          overflow: 'auto',
          fontSize: 11,
          fontWeight: 500,
          lineHeight: 1.5,
        }}>
          {text.slice(0, 2000)}{text.length > 2000 ? '\n...' : ''}
        </pre>
      )}
    </div>
  )
}

function ImagePreview({ data, mediaType }: { data: string; mediaType: string }) {
  const [hovered, setHovered] = useState(false)
  const [open, setOpen] = useState(false)

  const src = `data:${mediaType};base64,${data}`

  return (
    <>
      <div
        style={{ display: 'inline-block', cursor: 'pointer' }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setOpen(true)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ImageIcon size={13} style={{ color: '#6c71c4' }} strokeWidth={2} />
          <img
            src={src}
            style={{
              height: hovered ? 48 : 32,
              maxWidth: hovered ? 180 : 120,
              objectFit: 'cover',
              borderRadius: 3,
              border: `1px solid ${hovered ? 'var(--color-accent)' : 'var(--color-border)'}`,
              transition: 'all 0.15s ease',
            }}
          />
        </div>
      </div>

      {/* Full-size overlay on click */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <div style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            padding: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          }}>
            <img
              src={src}
              style={{
                maxWidth: '85vw',
                maxHeight: '85vh',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}
