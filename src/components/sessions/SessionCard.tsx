import { useState } from 'react'
import { Terminal, Monitor, Copy, Check } from 'lucide-react'
import type { Session } from '../../lib/types.ts'
import { relativeTimeShort, truncate } from '../../lib/format.ts'

interface SessionCardProps {
  session: Session
  isSelected: boolean
  onSelect: (sessionId: string) => void
}

export function SessionCard({ session, isSelected, onSelect }: SessionCardProps) {
  const [copied, setCopied] = useState(false)

  const copyResumeCommand = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(`cd ${session.cwd} && claude --resume ${session.sessionId}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const Icon = session.entrypoint === 'desktop' ? Monitor : Terminal
  const iconColor = session.isActive ? '#859900' : 'var(--color-text-muted)'

  return (
    <div
      onClick={() => onSelect(session.sessionId)}
      style={{
        background: isSelected ? 'var(--color-bg-secondary)' : 'transparent',
        borderLeft: isSelected ? '2px solid var(--color-accent)' : '2px solid transparent',
        padding: '7px 10px 7px 8px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 38,
      }}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--color-bg-tertiary)' }}
      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ position: 'relative', flexShrink: 0, width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} style={{ color: iconColor }} strokeWidth={2.2} />
        {session.isActive && (
          <div style={{
            position: 'absolute', top: -1, right: -1, width: 6, height: 6,
            borderRadius: '50%', background: '#859900',
            border: '1.5px solid var(--color-bg-primary)',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, opacity: session.isActive ? 1 : 0.7 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3,
        }}>
          {truncate(session.displayName, 45)}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
          color: 'var(--color-text-muted)', lineHeight: 1.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {session.projectName}
        </div>
      </div>

      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', flexShrink: 0 }}>
        {relativeTimeShort(session.lastActivityAt)}
      </span>

      {!session.isActive && (
        <button onClick={copyResumeCommand} style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 2,
          color: 'var(--color-text-muted)', flexShrink: 0, display: 'flex',
        }} title="Copy resume command">
          {copied ? <Check size={13} style={{ color: '#859900' }} /> : <Copy size={13} />}
        </button>
      )}
    </div>
  )
}
