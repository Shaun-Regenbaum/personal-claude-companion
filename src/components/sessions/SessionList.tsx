import { useState, useMemo } from 'react'
import type { Session } from '../../lib/types.ts'
import { SessionCard } from './SessionCard.tsx'
import { SessionFilter } from './SessionFilter.tsx'
import { groupByDay } from '../../lib/format.ts'

interface SessionListProps {
  sessions: Session[]
  selectedSessionId: string | null
  onSelectSession: (sessionId: string) => void
  loading: boolean
}

export function SessionList({ sessions, selectedSessionId, onSelectSession, loading }: SessionListProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

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

  const groups = useMemo(() => groupByDay(filtered), [filtered])
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
        <span className="pzl-label" style={{ fontSize: 10 }}>
          {activeCount} active / {sessions.length}
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
          Array.from(groups.entries()).map(([label, items]) => (
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
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
