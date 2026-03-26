import { Hono } from 'hono'
import { readFileSync, readdirSync, readlinkSync, existsSync } from 'fs'
import { join, basename } from 'path'

const CLAUDE_DIR = join(process.env.HOME ?? '', '.claude')

const app = new Hono()

app.get('/', (c) => {
  const settings = readJsonSafe(join(CLAUDE_DIR, 'settings.json'))
  const localSettings = readJsonSafe(join(CLAUDE_DIR, 'settings.local.json'))
  const plugins = getPlugins()
  const skills = getSkills()
  const mcpServers = getMcpServers(settings)
  const hooks = getHooks(settings)

  return c.json({ settings, localSettings, plugins, skills, mcpServers, hooks })
})

function readJsonSafe(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return {}
  }
}

function getPlugins() {
  const path = join(CLAUDE_DIR, 'plugins', 'installed_plugins.json')
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'))
    if (Array.isArray(data)) {
      return data.map((p: Record<string, unknown>) => ({
        name: p.name ?? p.pluginId ?? 'unknown',
        scope: p.scope ?? 'unknown',
        version: p.version ?? 'unknown',
        installedAt: p.installedAt ?? '',
        lastUpdated: p.lastUpdated ?? '',
      }))
    }
    // Handle object format
    return Object.entries(data).map(([key, val]) => {
      const v = val as Record<string, unknown>
      return {
        name: key,
        scope: v.scope ?? 'unknown',
        version: v.version ?? 'unknown',
        installedAt: v.installedAt ?? '',
        lastUpdated: v.lastUpdated ?? '',
      }
    })
  } catch {
    return []
  }
}

function getSkills() {
  const skillsDir = join(CLAUDE_DIR, 'skills')
  try {
    const entries = readdirSync(skillsDir)
    return entries.map((name) => {
      const fullPath = join(skillsDir, name)
      let target = fullPath
      try {
        target = readlinkSync(fullPath)
      } catch {
        // Not a symlink
      }
      return { name, path: fullPath, target }
    })
  } catch {
    return []
  }
}

function getMcpServers(settings: Record<string, unknown>) {
  const servers = (settings.mcpServers ?? {}) as Record<string, Record<string, unknown>>
  return Object.entries(servers).map(([name, config]) => ({
    name,
    command: config.command as string | undefined,
    enabled: config.disabled !== true,
    config,
  }))
}

function getHooks(settings: Record<string, unknown>) {
  const hooks = (settings.hooks ?? {}) as Record<string, unknown>
  const result: Array<{ event: string; matcher: string; command: string }> = []

  for (const [event, config] of Object.entries(hooks)) {
    if (Array.isArray(config)) {
      for (const hook of config) {
        const h = hook as Record<string, unknown>
        result.push({
          event,
          matcher: (h.matcher as string) ?? '*',
          command: (h.command as string) ?? JSON.stringify(h),
        })
      }
    } else if (typeof config === 'object' && config !== null) {
      const c = config as Record<string, unknown>
      const hookList = (c.hooks ?? []) as Array<Record<string, unknown>>
      for (const h of hookList) {
        result.push({
          event,
          matcher: (c.matcher as string) ?? '*',
          command: (h.command as string) ?? JSON.stringify(h),
        })
      }
    }
  }

  return result
}

export default app
