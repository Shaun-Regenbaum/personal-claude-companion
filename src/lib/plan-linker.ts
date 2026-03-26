import type { ConversationMessage } from './types.ts'

export interface PlanReference {
  planName: string
  messageUuid: string
  timestamp: string
  action: 'write' | 'edit' | 'exit-plan-mode'
}

export interface TaskInfo {
  taskId: string
  subject: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  messageUuid: string
  timestamp: string
}

export interface TaskEvent {
  taskId: string
  messageUuid: string
  timestamp: string
  event: 'created' | 'started' | 'completed'
  subject: string
}

const PLANS_PATH = '/.claude/plans/'

/**
 * Scan conversation messages and extract plan references and task events.
 */
export function extractPlanReferences(messages: ConversationMessage[]): PlanReference[] {
  const refs: PlanReference[] = []

  for (const msg of messages) {
    if (msg.type !== 'assistant') continue

    for (const block of msg.content) {
      if (block.type !== 'tool_use') continue

      if (block.name === 'ExitPlanMode') {
        const lastPlanRef = refs.findLast((r) => r.action === 'write' || r.action === 'edit')
        refs.push({
          planName: lastPlanRef?.planName ?? 'unknown',
          messageUuid: msg.uuid,
          timestamp: msg.timestamp,
          action: 'exit-plan-mode',
        })
        continue
      }

      if (block.name === 'Write' || block.name === 'Edit') {
        const filePath = block.input.file_path as string | undefined
        if (!filePath || !filePath.includes(PLANS_PATH)) continue

        const fileName = filePath.split('/').pop()?.replace('.md', '') ?? ''
        refs.push({
          planName: fileName,
          messageUuid: msg.uuid,
          timestamp: msg.timestamp,
          action: block.name === 'Write' ? 'write' : 'edit',
        })
      }
    }
  }

  return refs
}

/**
 * Extract task lifecycle from conversation.
 * Builds a task list from TaskCreate calls, then applies TaskUpdate status changes.
 */
export function extractTasks(messages: ConversationMessage[]): {
  tasks: TaskInfo[]
  events: TaskEvent[]
} {
  const taskMap = new Map<string, TaskInfo>()
  const events: TaskEvent[] = []

  for (const msg of messages) {
    if (msg.type !== 'assistant') continue

    for (const block of msg.content) {
      if (block.type !== 'tool_use') continue

      if (block.name === 'TaskCreate') {
        const subject = (block.input.subject as string) ?? ''
        const description = (block.input.description as string) ?? ''
        // TaskCreate doesn't return the ID in input — we get it from the tool_result
        // For now use a placeholder; we'll patch it from results
        const tempId = `temp-${events.length}`
        taskMap.set(tempId, {
          taskId: tempId,
          subject,
          description,
          status: 'pending',
          messageUuid: msg.uuid,
          timestamp: msg.timestamp,
        })
        events.push({
          taskId: tempId,
          messageUuid: msg.uuid,
          timestamp: msg.timestamp,
          event: 'created',
          subject,
        })
      }

      if (block.name === 'TaskUpdate') {
        const taskId = (block.input.taskId as string) ?? ''
        const status = (block.input.status as string) ?? ''

        // Find the task by matching taskId number to creation order
        const taskNum = parseInt(taskId, 10)
        const taskEntries = Array.from(taskMap.entries())
        if (taskNum > 0 && taskNum <= taskEntries.length) {
          const [key, task] = taskEntries[taskNum - 1]
          const newStatus = status as TaskInfo['status']
          task.status = newStatus
          task.taskId = taskId

          const eventType = newStatus === 'in_progress' ? 'started' as const
            : newStatus === 'completed' ? 'completed' as const
            : 'started' as const

          events.push({
            taskId,
            messageUuid: msg.uuid,
            timestamp: msg.timestamp,
            event: eventType,
            subject: task.subject,
          })
        }
      }
    }
  }

  return {
    tasks: Array.from(taskMap.values()),
    events,
  }
}

export function getActivePlan(refs: PlanReference[]): string | null {
  for (let i = refs.length - 1; i >= 0; i--) {
    if (refs[i].action === 'write' || refs[i].action === 'edit') {
      return refs[i].planName
    }
  }
  return null
}

export function getReferencedPlans(refs: PlanReference[]): string[] {
  return [...new Set(refs.map((r) => r.planName).filter((n) => n !== 'unknown'))]
}
