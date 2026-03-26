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
    // Format: { version: 2, plugins: { "name@marketplace": [{ scope, version, ... }] } }
    const pluginsMap = (data.plugins ?? data) as Record<string, unknown>
    if (typeof pluginsMap !== 'object') return []

    const result: Array<{ name: string; scope: string; version: string; installedAt: string; lastUpdated: string }> = []
    for (const [key, val] of Object.entries(pluginsMap)) {
      if (key === 'version' || !Array.isArray(val)) continue
      for (const entry of val) {
        const e = entry as Record<string, unknown>
        result.push({
          name: key,
          scope: (e.scope as string) ?? 'unknown',
          version: (e.version as string) ?? 'unknown',
          installedAt: (e.installedAt as string) ?? '',
          lastUpdated: (e.lastUpdated as string) ?? '',
        })
      }
    }
    return result
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
  const result: Array<{ event: string; matcher: string; command: string; source: string }> = []

  // Parse hooks from settings.json
  parseHooksObject(settings.hooks as Record<string, unknown> | undefined, 'settings.json', result)

  // Also parse hooks.json
  const hooksFile = readJsonSafe(join(CLAUDE_DIR, 'hooks.json'))
  parseHooksObject(hooksFile.hooks as Record<string, unknown> | undefined, 'hooks.json', result)

  return result
}

function parseHooksObject(
  hooks: Record<string, unknown> | undefined,
  source: string,
  result: Array<{ event: string; matcher: string; command: string; source: string }>,
) {
  if (!hooks || typeof hooks !== 'object') return

  for (const [event, config] of Object.entries(hooks)) {
    if (Array.isArray(config)) {
      for (const entry of config) {
        const e = entry as Record<string, unknown>
        const matcher = (e.matcher as string) ?? '*'
        const hookList = (e.hooks ?? []) as Array<Record<string, unknown>>
        if (hookList.length > 0) {
          for (const h of hookList) {
            result.push({ event, matcher, command: (h.command as string) ?? JSON.stringify(h), source })
          }
        } else if (e.command) {
          result.push({ event, matcher, command: e.command as string, source })
        }
      }
    }
  }
}

export default app
