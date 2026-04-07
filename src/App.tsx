import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'
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

  // Track saved scroll position and "return to" toast
  const savedScrollPos = useRef<number | null>(null)
  const [showReturnToast, setShowReturnToast] = useState(false)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { messages, loading: conversationLoading, refresh: refreshConversation } =
    useConversation(selectedSessionId)

  const selectedSession = useMemo(
    () => sessions.find((s) => s.sessionId === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  )

  // Extract plan references and tasks from current conversation
  const planRefs = useMemo(() => extractPlanReferences(messages), [messages])
  const sessionPlanNames = useMemo(() => getReferencedPlans(planRefs), [planRefs])
  const { events: taskEvents } = useMemo(() => extractTasks(messages), [messages])

  // Scroll to bottom when messages first load after switching sessions
  const lastScrolledSession = useRef<string | null>(null)
  useEffect(() => {
    if (!selectedSessionId || conversationLoading || messages.length === 0) return
    if (lastScrolledSession.current === selectedSessionId) return
    lastScrolledSession.current = selectedSessionId
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

  const handleTabChange = useCallback((tab: string) => {
    // When leaving timeline, save scroll position
    if (activeTab === 'timeline' && tab !== 'timeline' && scrollRef.current) {
      savedScrollPos.current = scrollRef.current.scrollTop
    }
    // When returning to timeline, scroll to bottom and offer return
    if (tab === 'timeline' && activeTab !== 'timeline') {
      const prevPos = savedScrollPos.current
      setTimeout(() => {
        if (scrollRef.current) {
          const wasAtBottom = prevPos !== null &&
            prevPos + scrollRef.current.clientHeight >= scrollRef.current.scrollHeight - 100
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
          // Only show toast if they were meaningfully scrolled up from bottom
          if (prevPos !== null && !wasAtBottom) {
            setShowReturnToast(true)
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
            toastTimerRef.current = setTimeout(() => setShowReturnToast(false), 5000)
          }
        }
      }, 50)
    }
    setActiveTab(tab)
  }, [activeTab])

  const handleReturnToPosition = useCallback(() => {
    if (scrollRef.current && savedScrollPos.current !== null) {
      scrollRef.current.scrollTo({ top: savedScrollPos.current, behavior: 'smooth' })
    }
    setShowReturnToast(false)
    savedScrollPos.current = null
  }, [])

  const handleSelectSession = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId)
    setActiveTab('timeline')
    setFocusedPlan(null)
    savedScrollPos.current = null
    setShowReturnToast(false)
  }, [])

  // Navigate to plan view (inline, not a separate tab)
  const handleClickPlan = useCallback((planName: string) => {
    setFocusedPlan(planName)
    handleTabChange('plans')
  }, [handleTabChange])

  // Navigate from timeline tool call to diffs tab
  const handleNavigateToTool = useCallback((toolUseId: string) => {
    setFocusedToolUseId(toolUseId)
    handleTabChange('diffs')
  }, [handleTabChange])

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
        position: 'relative',
      }}>
        <Header
          session={selectedSession}
          activeTab={activeTab}
          onTabChange={handleTabChange}
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

        {/* Return-to-position toast */}
        {showReturnToast && (
          <div
            onClick={handleReturnToPosition}
            style={{
              position: 'absolute',
              bottom: 12,
              right: 12,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 11,
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-mono)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              zIndex: 10,
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-text-muted)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
          >
            <ArrowUp size={11} />
            Return to previous position
          </div>
        )}
      </div>
    </div>
  )
}

export default App
