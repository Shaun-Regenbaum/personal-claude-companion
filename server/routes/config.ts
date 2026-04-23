import { Hono } from 'hono'
import { readFileSync, readdirSync, readlinkSync, existsSync, writeFileSync, unlinkSync, rmSync } from 'fs'
import { join, basename } from 'path'

const CLAUDE_DIR = join(process.env.HOME ?? '', '.claude')
const CLAUDE_JSON = join(process.env.HOME ?? '', '.claude.json')

const app = new Hono()

app.get('/', (c) => {
  const settings = readJsonSafe(join(CLAUDE_DIR, 'settings.json'))
  const localSettings = readJsonSafe(join(CLAUDE_DIR, 'settings.local.json'))
  const plugins = getPlugins()
  const skills = getSkills()
  const mcpServers = getMcpServers()
  const hooks = getHooks(settings)

  return c.json({ settings, localSettings, plugins, skills, mcpServers, hooks })
})

// Delete a skill (remove symlink)
app.delete('/skills/:name', (c) => {
  const name = c.req.param('name')
  const skillPath = join(CLAUDE_DIR, 'skills', name)
  try {
    if (existsSync(skillPath)) {
      rmSync(skillPath, { recursive: true })
      return c.json({ ok: true })
    }
    return c.json({ error: 'Skill not found' }, 404)
  } catch (e) {
    return c.json({ error: String(e) }, 500)
  }
})

// Delete an MCP server from ~/.claude.json (user scope or a specific project scope)
app.delete('/mcp/:name', (c) => {
  const name = c.req.param('name')
  const scope = c.req.query('scope') ?? 'user'
  const project = c.req.query('project')

  if (scope === 'project' && !project) {
    return c.json({ error: 'project query param required for scope=project' }, 400)
  }

  try {
    const data = JSON.parse(readFileSync(CLAUDE_JSON, 'utf-8'))
    const container = scope === 'project'
      ? (data.projects?.[project!]?.mcpServers as Record<string, unknown> | undefined)
      : (data.mcpServers as Record<string, unknown> | undefined)

    if (!container || !(name in container)) {
      return c.json({ error: 'MCP server not found' }, 404)
    }
    delete container[name]
    writeFileSync(CLAUDE_JSON, JSON.stringify(data, null, 2) + '\n')
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ error: String(e) }, 500)
  }
})

// Delete a plugin (remove from installed_plugins.json)
app.delete('/plugins/:name', (c) => {
  const name = c.req.param('name')
  const pluginsPath = join(CLAUDE_DIR, 'plugins', 'installed_plugins.json')
  try {
    const data = JSON.parse(readFileSync(pluginsPath, 'utf-8'))
    const plugins = data.plugins ?? {}
    if (!(name in plugins)) {
      return c.json({ error: 'Plugin not found' }, 404)
    }
    delete plugins[name]
    data.plugins = plugins
    writeFileSync(pluginsPath, JSON.stringify(data, null, 2) + '\n')
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ error: String(e) }, 500)
  }
})

// Delete a hook (remove from hooks.json or settings.json)
app.delete('/hooks/:source/:event/:index', (c) => {
  const source = c.req.param('source')
  const event = c.req.param('event')
  const index = parseInt(c.req.param('index'), 10)
  const filePath = source === 'hooks.json'
    ? join(CLAUDE_DIR, 'hooks.json')
    : join(CLAUDE_DIR, 'settings.json')

  try {
    const data = JSON.parse(readFileSync(filePath, 'utf-8'))
    const hooksObj = source === 'hooks.json' ? (data.hooks ?? {}) : (data.hooks ?? {})
    const eventHooks = hooksObj[event]
    if (!Array.isArray(eventHooks) || index >= eventHooks.length) {
      return c.json({ error: 'Hook not found' }, 404)
    }
    eventHooks.splice(index, 1)
    if (eventHooks.length === 0) {
      delete hooksObj[event]
    }
    if (source === 'hooks.json') {
      data.hooks = hooksObj
    } else {
      data.hooks = hooksObj
    }
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ error: String(e) }, 500)
  }
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
      let isSymlink = false
      let isBroken = false
      try {
        target = readlinkSync(fullPath)
        isSymlink = true
        isBroken = !existsSync(target)
      } catch {
        // Not a symlink
      }
      return { name, path: fullPath, target, isSymlink, isBroken }
    })
  } catch {
    return []
  }
}

function getMcpServers() {
  const data = readJsonSafe(CLAUDE_JSON)
  const result: Array<{
    name: string
    command?: string
    enabled: boolean
    scope: 'user' | 'project'
    projectPath?: string
    config: Record<string, unknown>
  }> = []

  const user = (data.mcpServers ?? {}) as Record<string, Record<string, unknown>>
  for (const [name, config] of Object.entries(user)) {
    result.push({
      name,
      command: describeMcp(config),
      enabled: config.disabled !== true,
      scope: 'user',
      config,
    })
  }

  const projects = (data.projects ?? {}) as Record<string, Record<string, unknown>>
  for (const [path, proj] of Object.entries(projects)) {
    const projServers = (proj.mcpServers ?? {}) as Record<string, Record<string, unknown>>
    for (const [name, config] of Object.entries(projServers)) {
      result.push({
        name,
        command: describeMcp(config),
        enabled: config.disabled !== true,
        scope: 'project',
        projectPath: path,
        config,
      })
    }
  }

  return result
}

function describeMcp(config: Record<string, unknown>): string | undefined {
  if (typeof config.command === 'string') {
    const args = Array.isArray(config.args) ? (config.args as unknown[]).join(' ') : ''
    return args ? `${config.command} ${args}` : config.command
  }
  if (typeof config.url === 'string') return config.url
  if (typeof config.type === 'string') return config.type
  return undefined
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
