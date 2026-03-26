import { useState, useCallback, useMemo } from 'react'
import { useSessions } from './hooks/useSessions.ts'
import { useConversation } from './hooks/useConversation.ts'
import { useSSE } from './hooks/useSSE.ts'
import { SessionList } from './components/sessions/SessionList.tsx'
import { Header } from './components/layout/Header.tsx'
import { TimelineView } from './components/timeline/TimelineView.tsx'

function App() {
  const { sessions, loading: sessionsLoading, refresh: refreshSessions } = useSessions()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('timeline')

  const { messages, loading: conversationLoading, refresh: refreshConversation } =
    useConversation(selectedSessionId)

  const selectedSession = useMemo(
    () => sessions.find((s) => s.sessionId === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  )

  useSSE({
    'session-update': useCallback(() => {
      refreshSessions()
    }, [refreshSessions]),
    'conversation-update': useCallback(
      (event: { sessionId?: string }) => {
        if (event.sessionId === selectedSessionId) {
          refreshConversation()
        }
        refreshSessions()
      },
      [selectedSessionId, refreshConversation, refreshSessions]
    ),
  })

  const handleSelectSession = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId)
    setActiveTab('timeline')
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: 300,
        flexShrink: 0,
        borderRight: '1px solid var(--color-border)',
        background: 'var(--color-bg-primary)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <SessionList
          sessions={sessions}
          selectedSessionId={selectedSessionId}
          onSelectSession={handleSelectSession}
          loading={sessionsLoading}
        />
      </div>

      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--color-bg-primary)',
      }}>
        <Header
          session={selectedSession}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'timeline' && selectedSessionId && (
            <TimelineView messages={messages} loading={conversationLoading} />
          )}
          {activeTab === 'diffs' && selectedSessionId && (
            <PlaceholderTab name="Diffs" />
          )}
          {activeTab === 'plans' && (
            <PlaceholderTab name="Plans" />
          )}
          {activeTab === 'config' && (
            <PlaceholderTab name="Config" />
          )}
          {!selectedSessionId && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div className="pzl-section-title" style={{ fontSize: 16, marginBottom: 4 }}>
                  Claude Companion
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  Select a session from the sidebar
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PlaceholderTab({ name }: { name: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: 256,
      color: 'var(--color-text-muted)',
      fontSize: 13,
    }}>
      <div className="pzl-card" style={{ padding: 32, textAlign: 'center' }}>
        <div className="pzl-card-title">{name}</div>
        <div style={{ color: 'var(--color-text-secondary)' }}>Coming in next phase</div>
      </div>
    </div>
  )
}

export default App
