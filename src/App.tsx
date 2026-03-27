import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useSessions } from './hooks/useSessions.ts'
import { useConversation } from './hooks/useConversation.ts'
import { useSSE } from './hooks/useSSE.ts'
import { SessionList } from './components/sessions/SessionList.tsx'
import { Header } from './components/layout/Header.tsx'
import { TimelineView } from './components/timeline/TimelineView.tsx'
import { PlanViewer } from './components/plans/PlanViewer.tsx'
import { DiffsViewer } from './components/diffs/DiffsViewer.tsx'
import { ConfigViewer } from './components/config/ConfigViewer.tsx'
import { extractPlanReferences, extractTasks, getReferencedPlans } from './lib/plan-linker.ts'

function App() {
  const { sessions, loading: sessionsLoading, refresh: refreshSessions } = useSessions()
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('timeline')
  const [focusedPlan, setFocusedPlan] = useState<string | null>(null)
  const [focusedToolUseId, setFocusedToolUseId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { messages, loading: conversationLoading, refresh: refreshConversation } =
    useConversation(selectedSessionId)

  const selectedSession = useMemo(
    () => sessions.find((s) => s.sessionId === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  )

  // Extract plan references and tasks from current conversation
  const planRefs = useMemo(() => extractPlanReferences(messages), [messages])
  const sessionPlanNames = useMemo(() => getReferencedPlans(planRefs), [planRefs])
  const { tasks, events: taskEvents } = useMemo(() => extractTasks(messages), [messages])

  // Scroll to bottom when messages first load after switching sessions
  // Scroll to bottom when messages load for a new session
  const lastScrolledSession = useRef<string | null>(null)
  useEffect(() => {
    if (!selectedSessionId || conversationLoading || messages.length === 0) return
    if (lastScrolledSession.current === selectedSessionId) return
    lastScrolledSession.current = selectedSessionId
    // Use setTimeout to wait for React to finish rendering all messages
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    }, 100)
  }, [selectedSessionId, conversationLoading, messages.length])

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
    setFocusedPlan(null)
  }, [])

  // Navigate to plan view (inline, not a separate tab)
  const handleClickPlan = useCallback((planName: string) => {
    setFocusedPlan(planName)
    setActiveTab('plans')
  }, [])

  // First session plan name for the header button
  const firstPlanName = sessionPlanNames.length > 0 ? sessionPlanNames[0] : null
  const handleHeaderPlanClick = useCallback(() => {
    if (firstPlanName) {
      setFocusedPlan(firstPlanName)
      setActiveTab('plans')
    }
  }, [firstPlanName])

  // Navigate from timeline tool call to diffs tab
  const handleNavigateToTool = useCallback((toolUseId: string) => {
    setFocusedToolUseId(toolUseId)
    setActiveTab('diffs')
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
          planName={firstPlanName}
          onClickPlan={handleHeaderPlanClick}
        />

        <div ref={scrollRef} style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          transform: 'translateZ(0)',
          willChange: 'scroll-position',
        }}>
          {activeTab === 'timeline' && selectedSessionId && (
            <TimelineView
              sessionId={selectedSessionId}
              messages={messages}
              loading={conversationLoading}
              planRefs={planRefs}
              taskEvents={taskEvents}
              tasks={tasks}
              onClickPlan={handleClickPlan}
              onNavigateToTool={handleNavigateToTool}
            />
          )}
          {activeTab === 'diffs' && selectedSessionId && (
            <DiffsViewer
              sessionId={selectedSessionId}
              initialToolUseId={focusedToolUseId}
            />
          )}
          {activeTab === 'plans' && (
            <PlanViewer
              sessionPlanNames={sessionPlanNames}
              initialPlan={focusedPlan}
              tasks={tasks}
              taskEvents={taskEvents}
              planRefs={planRefs}
            />
          )}
          {activeTab === 'config' && (
            <ConfigViewer sessionCwd={selectedSession?.cwd ?? null} />
          )}
          {!selectedSessionId && activeTab !== 'config' && (
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
