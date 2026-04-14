import { useState, useMemo, useCallback } from 'react'
import { Sparkles } from 'lucide-react'
import type { Session } from '../../lib/types.ts'
import { SessionCard } from './SessionCard.tsx'
import { SessionFilter } from './SessionFilter.tsx'
import { groupByDay } from '../../lib/format.ts'
import { api } from '../../lib/api.ts'

interface SessionListProps {
  sessions: Session[]
  selectedSessionId: string | null
  onSelectSession: (sessionId: string) => void
  onRefresh: () => void
  loading: boolean
}

export function SessionList({ sessions, selectedSessionId, onSelectSession, onRefresh, loading }: SessionListProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [renaming, setRenaming] = useState(false)

  const handleBatchRename = useCallback(async () => {
    setRenaming(true)
    try {
      await api.generateAllTitles()
    } catch {
      // SSE events will refresh the list as titles come in
    } finally {
      setRenaming(false)
    }
  }, [])

  const handleTogglePin = useCallback(async (sessionId: string, pinned: boolean) => {
    try {
      if (pinned) {
        await api.pinSession(sessionId)
      } else {
        await api.unpinSession(sessionId)
      }
      onRefresh()
    } catch {
      // Silently fail
    }
  }, [onRefresh])

  const filtered = useMemo(() => {
    let result = sessions
    if (statusFilter === 'active') result = result.filter((s) => s.isActive)
    else if (statusFilter === 'inactive') result = result.filter((s) => !s.isActive)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) =>
          s.displayName.toLowerCase().includes(q) ||
          s.projectName.toLowerCase().includes(q) ||
          s.cwd.toLowerCase().includes(q)
      )
    }
    return result
  }, [sessions, search, statusFilter])

  const pinned = useMemo(() => filtered.filter((s) => s.isPinned), [filtered])
  const unpinned = useMemo(() => filtered.filter((s) => !s.isPinned), [filtered])
  const groups = useMemo(() => groupByDay(unpinned), [unpinned])
  const activeCount = sessions.filter((s) => s.isActive).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '12px 12px 0',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
      }}>
        <span className="pzl-section-title" style={{ fontSize: 12 }}>Sessions</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={handleBatchRename}
            disabled={renaming}
            title="Generate AI titles for all sessions"
            style={{
              background: 'none',
              border: '1px solid var(--color-border)',
              borderRadius: 4,
              padding: '2px 5px',
              cursor: renaming ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10,
              color: renaming ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
              fontFamily: 'var(--font-mono)',
              opacity: renaming ? 0.6 : 1,
            }}
          >
            <Sparkles size={10} />
            {renaming ? 'Naming...' : 'Name'}
          </button>
          <span className="pzl-label" style={{ fontSize: 10 }}>
            {activeCount} active / {sessions.length}
          </span>
        </span>
      </div>

      <div style={{ padding: '8px 0 0' }}>
        <SessionFilter
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {loading ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
            No sessions found
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <div key="Pinned">
                <div className="pzl-label" style={{
                  padding: '8px 12px 2px',
                  fontSize: 10,
                  borderBottom: '1px solid var(--color-border)',
                  marginBottom: 2,
                  color: 'var(--color-accent)',
                }}>
                  Pinned
                </div>
                {pinned.map((session) => (
                  <SessionCard
                    key={session.sessionId}
                    session={session as Session}
                    isSelected={selectedSessionId === session.sessionId}
                    onSelect={onSelectSession}
                    onTogglePin={handleTogglePin}
                  />
                ))}
              </div>
            )}
            {Array.from(groups.entries()).map(([label, items]) => (
              <div key={label}>
                <div className="pzl-label" style={{
                  padding: '8px 12px 2px',
                  fontSize: 10,
                  borderBottom: '1px solid var(--color-border)',
                  marginBottom: 2,
                }}>
                  {label}
                </div>
                {items.map((session) => (
                  <SessionCard
                    key={session.sessionId}
                    session={session as Session}
                    isSelected={selectedSessionId === session.sessionId}
                    onSelect={onSelectSession}
                    onTogglePin={handleTogglePin}
                  />
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
