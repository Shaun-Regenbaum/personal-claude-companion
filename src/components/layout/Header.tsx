import { GitBranch, MessageSquare, Terminal, Monitor } from 'lucide-react'
import type { Session } from '../../lib/types.ts'

interface HeaderProps {
  session: Session | null
  activeTab: string
  onTabChange: (tab: string) => void
}

const tabs = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'diffs', label: 'Diffs' },
  { id: 'plans', label: 'Plans' },
  { id: 'config', label: 'Config' },
]

export function Header({ session, activeTab, onTabChange }: HeaderProps) {
  if (!session) {
    return (
      <div style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div style={{
          padding: '12px 24px',
          background: 'var(--color-bg-secondary)',
          color: 'var(--color-text-muted)',
          fontSize: 12,
        }}>
          Select a session to view timeline, diffs, and plans
        </div>
        <div style={{ padding: '4px 16px 6px', background: 'var(--color-bg-secondary)' }}>
          <div className="pzl-tabs" style={{ display: 'inline-flex' }}>
            <button
              onClick={() => onTabChange('config')}
              className={`pzl-tab ${activeTab === 'config' ? 'pzl-tab-active' : ''}`}
              style={{ fontSize: 12, padding: '5px 14px' }}
            >
              Config
            </button>
          </div>
        </div>
      </div>
    )
  }

  const EntryIcon = session.entrypoint === 'desktop' ? Monitor : Terminal

  return (
    <div style={{ borderBottom: '1px solid var(--color-border)' }}>
      {/* Session info - single dense row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 16px',
        background: 'var(--color-bg-secondary)',
      }}>
        {/* Status dot */}
        <div style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: session.isActive ? 'var(--color-sol-green)' : 'var(--color-border)',
          flexShrink: 0,
        }} />

        <EntryIcon size={13} style={{ color: '#a89984', flexShrink: 0 }} />

        {/* Title */}
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {session.displayName}
        </span>

        {/* Metadata chips */}
        <span className="pzl-mono" style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
          {session.cwd}
        </span>

        {session.gitBranch && session.gitBranch !== 'HEAD' && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 10,
            color: '#b16286',
            fontFamily: 'var(--font-mono)',
          }}>
            <GitBranch size={11} />
            {session.gitBranch}
          </span>
        )}

        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          fontSize: 10,
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-mono)',
        }}>
          <MessageSquare size={11} />
          {session.messageCount}
        </span>
      </div>

      {/* Tabs */}
      <div style={{ padding: '4px 16px 6px', background: 'var(--color-bg-secondary)' }}>
        <div className="pzl-tabs" style={{ display: 'inline-flex' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`pzl-tab ${activeTab === tab.id ? 'pzl-tab-active' : ''}`}
              style={{ fontSize: 12, padding: '5px 14px' }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
