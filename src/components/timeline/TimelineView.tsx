import { useMemo } from 'react'
import type { ConversationMessage } from '../../lib/types.ts'
import { TimelineMessage } from './TimelineMessage.tsx'

interface TimelineViewProps {
  messages: ConversationMessage[]
  loading: boolean
}

export function TimelineView({ messages, loading }: TimelineViewProps) {
  const toolResults = useMemo(() => {
    const map = new Map<string, string>()
    for (const msg of messages) {
      if (msg.type !== 'user') continue
      for (const block of msg.content) {
        if (block.type === 'tool_result' && block.tool_use_id) {
          const text = block.content
            .map((c) => (c.type === 'text' ? c.text : ''))
            .join('\n')
            .slice(0, 3000)
          map.set(block.tool_use_id, text)
        }
      }
    }
    return map
  }, [messages])

  const displayMessages = useMemo(() => {
    return messages.filter((msg) => {
      if (msg.type === 'user') {
        return msg.content.some((b) => b.type === 'text' && b.text.trim())
      }
      return true
    })
  }, [messages])

  if (loading && messages.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 256,
        color: 'var(--color-text-muted)',
        fontSize: 13,
      }}>
        Loading conversation...
      </div>
    )
  }

  if (displayMessages.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 256,
        color: 'var(--color-text-muted)',
        fontSize: 13,
      }}>
        No messages in this session
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 24px 24px' }}>
      {displayMessages.map((msg) => (
        <TimelineMessage key={msg.uuid || msg.timestamp} message={msg} toolResults={toolResults} />
      ))}
    </div>
  )
}
