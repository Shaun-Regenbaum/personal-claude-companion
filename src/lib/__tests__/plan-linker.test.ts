import { describe, it, expect } from 'vitest'
import { extractPlanReferences, extractTasks, getActivePlan, getReferencedPlans } from '../plan-linker'
import type { ConversationMessage } from '../types'

function makeAssistantMsg(content: ConversationMessage['content'], uuid = 'msg-1'): ConversationMessage {
  return {
    uuid,
    parentUuid: null,
    type: 'assistant',
    timestamp: '2026-03-27T12:00:00Z',
    content,
  }
}

describe('extractPlanReferences', () => {
  it('returns empty array for no messages', () => {
    expect(extractPlanReferences([])).toEqual([])
  })

  it('ignores non-assistant messages', () => {
    const msg: ConversationMessage = {
      uuid: 'msg-1', parentUuid: null, type: 'user',
      timestamp: '2026-03-27T12:00:00Z',
      content: [{ type: 'tool_use', id: '1', name: 'Write', input: { file_path: '/.claude/plans/my-plan.md' } }],
    }
    expect(extractPlanReferences([msg])).toEqual([])
  })

  it('extracts Write to plan file', () => {
    const msg = makeAssistantMsg([
      { type: 'tool_use', id: '1', name: 'Write', input: { file_path: '/home/user/.claude/plans/my-plan.md' } },
    ])
    const refs = extractPlanReferences([msg])
    expect(refs).toHaveLength(1)
    expect(refs[0].planName).toBe('my-plan')
    expect(refs[0].action).toBe('write')
  })

  it('extracts Edit to plan file', () => {
    const msg = makeAssistantMsg([
      { type: 'tool_use', id: '1', name: 'Edit', input: { file_path: '/home/.claude/plans/fix.md' } },
    ])
    const refs = extractPlanReferences([msg])
    expect(refs).toHaveLength(1)
    expect(refs[0].planName).toBe('fix')
    expect(refs[0].action).toBe('edit')
  })

  it('ignores Write to non-plan files', () => {
    const msg = makeAssistantMsg([
      { type: 'tool_use', id: '1', name: 'Write', input: { file_path: '/src/file.ts' } },
    ])
    expect(extractPlanReferences([msg])).toEqual([])
  })

  it('extracts ExitPlanMode with last plan name', () => {
    const msgs = [
      makeAssistantMsg([
        { type: 'tool_use', id: '1', name: 'Write', input: { file_path: '/home/.claude/plans/my-plan.md' } },
      ], 'msg-1'),
      makeAssistantMsg([
        { type: 'tool_use', id: '2', name: 'ExitPlanMode', input: {} },
      ], 'msg-2'),
    ]
    const refs = extractPlanReferences(msgs)
    expect(refs).toHaveLength(2)
    expect(refs[1].action).toBe('exit-plan-mode')
    expect(refs[1].planName).toBe('my-plan')
  })

  it('ExitPlanMode with no prior plan uses "unknown"', () => {
    const msg = makeAssistantMsg([
      { type: 'tool_use', id: '1', name: 'ExitPlanMode', input: {} },
    ])
    const refs = extractPlanReferences([msg])
    expect(refs[0].planName).toBe('unknown')
  })
})

describe('extractTasks', () => {
  it('returns empty for no messages', () => {
    const { tasks, events } = extractTasks([])
    expect(tasks).toEqual([])
    expect(events).toEqual([])
  })

  it('extracts TaskCreate', () => {
    const msg = makeAssistantMsg([
      { type: 'tool_use', id: '1', name: 'TaskCreate', input: { subject: 'Fix bug', description: 'Fix the login bug' } },
    ])
    const { tasks, events } = extractTasks([msg])
    expect(tasks).toHaveLength(1)
    expect(tasks[0].subject).toBe('Fix bug')
    expect(tasks[0].status).toBe('pending')
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('created')
  })

  it('applies TaskUpdate status changes', () => {
    const msgs = [
      makeAssistantMsg([
        { type: 'tool_use', id: '1', name: 'TaskCreate', input: { subject: 'Task 1', description: '' } },
      ], 'msg-1'),
      makeAssistantMsg([
        { type: 'tool_use', id: '2', name: 'TaskUpdate', input: { taskId: '1', status: 'in_progress' } },
      ], 'msg-2'),
    ]
    const { tasks, events } = extractTasks(msgs)
    expect(tasks[0].status).toBe('in_progress')
    expect(events).toHaveLength(2)
    expect(events[1].event).toBe('started')
  })

  it('tracks completion', () => {
    const msgs = [
      makeAssistantMsg([
        { type: 'tool_use', id: '1', name: 'TaskCreate', input: { subject: 'Task 1', description: '' } },
      ], 'msg-1'),
      makeAssistantMsg([
        { type: 'tool_use', id: '2', name: 'TaskUpdate', input: { taskId: '1', status: 'completed' } },
      ], 'msg-2'),
    ]
    const { tasks, events } = extractTasks(msgs)
    expect(tasks[0].status).toBe('completed')
    expect(events[1].event).toBe('completed')
  })
})

describe('getActivePlan', () => {
  it('returns null for empty refs', () => {
    expect(getActivePlan([])).toBeNull()
  })

  it('returns the last written/edited plan', () => {
    const refs = [
      { planName: 'plan-a', messageUuid: '1', timestamp: '', action: 'write' as const },
      { planName: 'plan-b', messageUuid: '2', timestamp: '', action: 'write' as const },
      { planName: 'plan-b', messageUuid: '3', timestamp: '', action: 'exit-plan-mode' as const },
    ]
    expect(getActivePlan(refs)).toBe('plan-b')
  })

  it('ignores exit-plan-mode actions', () => {
    const refs = [
      { planName: 'plan-a', messageUuid: '1', timestamp: '', action: 'exit-plan-mode' as const },
    ]
    expect(getActivePlan(refs)).toBeNull()
  })
})

describe('getReferencedPlans', () => {
  it('returns empty array for no refs', () => {
    expect(getReferencedPlans([])).toEqual([])
  })

  it('returns unique plan names', () => {
    const refs = [
      { planName: 'plan-a', messageUuid: '1', timestamp: '', action: 'write' as const },
      { planName: 'plan-a', messageUuid: '2', timestamp: '', action: 'edit' as const },
      { planName: 'plan-b', messageUuid: '3', timestamp: '', action: 'write' as const },
    ]
    expect(getReferencedPlans(refs)).toEqual(['plan-a', 'plan-b'])
  })

  it('filters out "unknown"', () => {
    const refs = [
      { planName: 'unknown', messageUuid: '1', timestamp: '', action: 'exit-plan-mode' as const },
      { planName: 'plan-a', messageUuid: '2', timestamp: '', action: 'write' as const },
    ]
    expect(getReferencedPlans(refs)).toEqual(['plan-a'])
  })
})
