import { watch } from 'chokidar'
import { join } from 'path'
import { emit } from './event-bus.ts'
import { invalidateSessionCache } from '../data/session-discovery.ts'
import { invalidateConversationCache } from '../data/conversation-parser.ts'
import { invalidateActivityCache } from '../data/activity-reader.ts'
import { onConversationChanged } from '../routes/summary.ts'

const CLAUDE_DIR = join(process.env.HOME ?? '', '.claude')

let debounceTimers = new Map<string, ReturnType<typeof setTimeout>>()

function debounced(key: string, fn: () => void, ms = 500) {
  const existing = debounceTimers.get(key)
  if (existing) clearTimeout(existing)
  debounceTimers.set(key, setTimeout(() => {
    debounceTimers.delete(key)
    fn()
  }, ms))
}

export function startFileWatcher(): void {
  // Watch active sessions
  const sessionsWatcher = watch(join(CLAUDE_DIR, 'sessions'), {
    ignoreInitial: true,
    depth: 0,
  })

  sessionsWatcher.on('all', (event, path) => {
    debounced('sessions', () => {
      invalidateSessionCache()
      emit({ type: 'session-update', timestamp: new Date().toISOString() })
    })
  })

  // Watch project conversation files
  const projectsWatcher = watch(join(CLAUDE_DIR, 'projects'), {
    ignoreInitial: true,
    depth: 2,
    ignored: /(^|[\/\\])\../, // ignore dotfiles
  })

  projectsWatcher.on('change', (path) => {
    if (path.endsWith('.jsonl')) {
      debounced(`conv:${path}`, () => {
        invalidateConversationCache(path)
        // Extract sessionId from filename
        const match = path.match(/([a-f0-9-]{36})\.jsonl$/)
        const sessionId = match?.[1]
        invalidateSessionCache()
        emit({
          type: 'conversation-update',
          sessionId,
          timestamp: new Date().toISOString(),
        })
        // Trigger debounced summary refresh for this session
        if (sessionId) onConversationChanged(sessionId)
      })
    }
  })

  projectsWatcher.on('add', (path) => {
    if (path.endsWith('.jsonl')) {
      debounced('new-session', () => {
        invalidateSessionCache()
        emit({ type: 'session-update', timestamp: new Date().toISOString() })
      })
    }
  })

  // Watch plans
  const plansWatcher = watch(join(CLAUDE_DIR, 'plans'), {
    ignoreInitial: true,
    depth: 0,
  })

  plansWatcher.on('all', () => {
    debounced('plans', () => {
      emit({ type: 'plan-update', timestamp: new Date().toISOString() })
    })
  })

  // Watch config
  const configWatcher = watch(
    [join(CLAUDE_DIR, 'settings.json'), join(CLAUDE_DIR, 'settings.local.json')],
    { ignoreInitial: true }
  )

  configWatcher.on('change', () => {
    debounced('config', () => {
      emit({ type: 'config-update', timestamp: new Date().toISOString() })
    })
  })

  // Watch companion activity log
  const activityPath = join(CLAUDE_DIR, 'companion-activity.jsonl')
  const activityWatcher = watch(activityPath, {
    ignoreInitial: true,
  })

  activityWatcher.on('change', () => {
    debounced('activity', () => {
      invalidateActivityCache()
      emit({ type: 'activity-update', timestamp: new Date().toISOString() })
    }, 300)
  })

  console.log('[watcher] File watchers started')
}
