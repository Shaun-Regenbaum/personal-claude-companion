import { useState, useCallback } from 'react'
import {
  Server, Puzzle, Zap, Wrench, Shield, Trash2,
  CheckCircle2, XCircle, Link2, AlertTriangle
} from 'lucide-react'
import { useConfig } from '../../hooks/useConfig.ts'
import { relativeTime } from '../../lib/format.ts'
import { api } from '../../lib/api.ts'
import type { McpServerInfo, PluginInfo, SkillInfo, HookInfo } from '../../lib/types.ts'

type Section = 'mcp' | 'plugins' | 'skills' | 'hooks' | 'permissions'

interface ConfigViewerProps {
  sessionCwd?: string | null
}

const SECTIONS: { id: Section; label: string; icon: typeof Server }[] = [
  { id: 'mcp', label: 'MCP Servers', icon: Server },
  { id: 'plugins', label: 'Plugins', icon: Puzzle },
  { id: 'skills', label: 'Skills', icon: Wrench },
  { id: 'hooks', label: 'Hooks', icon: Zap },
  { id: 'permissions', label: 'Permissions', icon: Shield },
]

export function ConfigViewer({ sessionCwd }: ConfigViewerProps) {
  const { config, loading, refresh } = useConfig()
  const [activeSection, setActiveSection] = useState<Section>('mcp')

  const handleDelete = useCallback(async (
    type: string,
    name: string,
    extra?: { source?: string; event?: string; index?: number; scope?: 'user' | 'project'; project?: string },
  ) => {
    const confirmed = window.confirm(`Delete ${type} "${name}"?`)
    if (!confirmed) return

    try {
      if (type === 'skill') await api.deleteSkill(name)
      else if (type === 'MCP server') await api.deleteMcp(name, extra?.scope ?? 'user', extra?.project)
      else if (type === 'plugin') await api.deletePlugin(name)
      else if (type === 'hook' && extra) await api.deleteHook(extra.source!, extra.event!, extra.index!)
      refresh()
    } catch {
      // ignore
    }
  }, [refresh])

  if (loading || !config) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256, color: 'var(--color-text-muted)', fontSize: 13 }}>
        Loading configuration...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Section nav */}
      <div style={{
        width: 200,
        flexShrink: 0,
        borderRight: '1px solid var(--color-border)',
        padding: '12px 0',
      }}>
        <div className="pzl-card-title" style={{ padding: '0 12px 4px' }}>Global Config</div>
        {sessionCwd && (
          <div style={{
            padding: '0 12px 8px',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--color-text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {sessionCwd}
          </div>
        )}
        {SECTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveSection(id)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 12px',
              border: 'none',
              background: activeSection === id ? 'var(--color-bg-secondary)' : 'transparent',
              borderLeft: activeSection === id ? '2px solid var(--color-accent)' : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: activeSection === id ? 600 : 500,
              color: activeSection === id ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => { if (activeSection !== id) e.currentTarget.style.background = 'var(--color-bg-tertiary)' }}
            onMouseLeave={(e) => { if (activeSection !== id) e.currentTarget.style.background = 'transparent' }}
          >
            <Icon size={14} strokeWidth={2} />
            {label}
            <span style={{
              marginLeft: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--color-text-muted)',
            }}>
              {id === 'mcp' ? config.mcpServers.length
                : id === 'plugins' ? config.plugins.length
                : id === 'skills' ? config.skills.length
                : id === 'hooks' ? config.hooks.length
                : ''}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {activeSection === 'mcp' && <McpSection servers={config.mcpServers} onDelete={handleDelete} />}
        {activeSection === 'plugins' && <PluginsSection plugins={config.plugins} onDelete={handleDelete} />}
        {activeSection === 'skills' && <SkillsSection skills={config.skills} onDelete={handleDelete} />}
        {activeSection === 'hooks' && <HooksSection hooks={config.hooks} onDelete={handleDelete} />}
        {activeSection === 'permissions' && <PermissionsSection settings={config.settings} localSettings={config.localSettings} />}
      </div>
    </div>
  )
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 3,
        color: 'var(--color-text-muted)',
        display: 'flex',
        borderRadius: 3,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = '#dc322f' }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)' }}
      title="Delete"
    >
      <Trash2 size={13} strokeWidth={2} />
    </button>
  )
}

function McpSection({ servers, onDelete }: {
  servers: McpServerInfo[]
  onDelete: (type: string, name: string, extra: { scope: 'user' | 'project'; project?: string }) => void
}) {
  if (servers.length === 0) return <EmptyState text="No MCP servers configured" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {servers.map((server) => (
        <div key={`${server.scope}:${server.projectPath ?? ''}:${server.name}`} className="pzl-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Server size={14} style={{ color: server.enabled ? '#859900' : 'var(--color-text-muted)' }} strokeWidth={2} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', flex: 1 }}>
              {server.name}
            </span>
            <span style={{
              fontSize: 9,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '2px 6px',
              borderRadius: 2,
              background: server.scope === 'user' ? '#268bd215' : '#b5890015',
              color: server.scope === 'user' ? '#268bd2' : '#b58900',
            }}>
              {server.scope}
            </span>
            <span style={{
              fontSize: 9,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '2px 6px',
              borderRadius: 2,
              background: server.enabled ? '#85990015' : '#dc322f15',
              color: server.enabled ? '#859900' : '#dc322f',
            }}>
              {server.enabled ? 'Enabled' : 'Disabled'}
            </span>
            <DeleteButton onClick={() => onDelete('MCP server', server.name, { scope: server.scope, project: server.projectPath })} />
          </div>
          {server.projectPath && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--color-text-muted)',
              marginBottom: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {server.projectPath}
            </div>
          )}
          {server.command && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--color-text-muted)',
              background: 'var(--color-bg-tertiary)',
              padding: '4px 8px',
              borderRadius: 3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {server.command}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function PluginsSection({ plugins, onDelete }: { plugins: PluginInfo[]; onDelete: (type: string, name: string) => void }) {
  if (plugins.length === 0) return <EmptyState text="No plugins installed" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {plugins.map((plugin, i) => (
        <div key={`${plugin.name}-${i}`} className="pzl-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Puzzle size={14} style={{ color: '#6c71c4' }} strokeWidth={2} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', flex: 1 }}>
              {plugin.name.split('@')[0]}
            </span>
            <span style={{
              fontSize: 9,
              fontWeight: 600,
              textTransform: 'uppercase',
              padding: '2px 6px',
              borderRadius: 2,
              background: plugin.scope === 'user' ? '#268bd215' : '#b5890015',
              color: plugin.scope === 'user' ? '#268bd2' : '#b58900',
            }}>
              {plugin.scope}
            </span>
            {plugin.version !== 'unknown' && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-text-muted)' }}>
                v{plugin.version}
              </span>
            )}
            <DeleteButton onClick={() => onDelete('plugin', plugin.name)} />
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--color-text-muted)' }}>
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              {plugin.name.split('@')[1] ?? ''}
            </span>
            {plugin.installedAt && (
              <span>installed {relativeTime(new Date(plugin.installedAt).getTime())}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function SkillsSection({ skills, onDelete }: { skills: SkillInfo[]; onDelete: (type: string, name: string) => void }) {
  if (skills.length === 0) return <EmptyState text="No skills configured" />

  const healthy = skills.filter((s) => !s.isBroken)
  const broken = skills.filter((s) => s.isBroken)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {broken.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          background: '#dc322f10',
          border: '1px solid #dc322f30',
          borderRadius: 4,
          marginBottom: 4,
        }}>
          <AlertTriangle size={13} style={{ color: '#dc322f' }} strokeWidth={2} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#dc322f' }}>
            {broken.length} broken symlink{broken.length > 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            Target repo may not be cloned
          </span>
        </div>
      )}

      {[...broken, ...healthy].map((skill) => (
        <div key={skill.name} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          border: `1px solid ${skill.isBroken ? '#dc322f30' : 'var(--color-border)'}`,
          borderRadius: 4,
          background: skill.isBroken ? '#dc322f08' : 'var(--color-bg-secondary)',
          opacity: skill.isBroken ? 0.8 : 1,
        }}>
          {skill.isBroken ? (
            <AlertTriangle size={13} style={{ color: '#dc322f', flexShrink: 0 }} strokeWidth={2} />
          ) : skill.isSymlink ? (
            <Link2 size={13} style={{ color: '#2aa198', flexShrink: 0 }} strokeWidth={2} />
          ) : (
            <Wrench size={13} style={{ color: '#2aa198', flexShrink: 0 }} strokeWidth={2} />
          )}
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: skill.isBroken ? '#dc322f' : 'var(--color-text-primary)',
          }}>
            {skill.name}
          </span>
          {skill.isSymlink && (
            <span style={{
              fontSize: 9,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '2px 6px',
              borderRadius: 2,
              background: skill.isBroken ? '#dc322f15' : '#2aa19815',
              color: skill.isBroken ? '#dc322f' : '#2aa198',
            }}>
              {skill.isBroken ? 'Broken' : 'Linked'}
            </span>
          )}
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--color-text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            textAlign: 'right',
          }}>
            {skill.target}
          </span>
          <DeleteButton onClick={() => onDelete('skill', skill.name)} />
        </div>
      ))}
    </div>
  )
}

function HooksSection({ hooks, onDelete }: { hooks: HookInfo[]; onDelete: (type: string, name: string, extra: { source: string; event: string; index: number }) => void }) {
  if (hooks.length === 0) return <EmptyState text="No hooks configured" />

  // Group by event for counting index per source+event
  const indexMap = new Map<string, number>()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {hooks.map((hook, i) => {
        const key = `${hook.source}:${hook.event}`
        const idx = indexMap.get(key) ?? 0
        indexMap.set(key, idx + 1)

        return (
          <div key={i} className="pzl-card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Zap size={14} style={{ color: '#b58900' }} strokeWidth={2} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', flex: 1 }}>
                {hook.event}
              </span>
              {hook.matcher !== '*' && (
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--color-text-muted)',
                  background: 'var(--color-bg-tertiary)',
                  padding: '1px 5px',
                  borderRadius: 2,
                }}>
                  {hook.matcher}
                </span>
              )}
              <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>
                {hook.source}
              </span>
              <DeleteButton onClick={() => onDelete('hook', hook.event, { source: hook.source, event: hook.event, index: idx })} />
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
              background: 'var(--color-bg-tertiary)',
              padding: '6px 8px',
              borderRadius: 3,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              maxHeight: 120,
              overflow: 'auto',
              lineHeight: 1.5,
            }}>
              {hook.command}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PermissionsSection({ settings, localSettings }: { settings: Record<string, unknown>; localSettings: Record<string, unknown> }) {
  const allow = (settings.permissions as Record<string, unknown>)?.allow as string[] ?? []
  const deny = (settings.permissions as Record<string, unknown>)?.deny as string[] ?? []
  const localAllow = (localSettings.permissions as Record<string, unknown>)?.allow as string[] ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {allow.length > 0 && (
        <div>
          <div className="pzl-card-title">Allowed ({allow.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {allow.map((perm, i) => (
              <PermissionChip key={i} text={perm} type="allow" />
            ))}
          </div>
        </div>
      )}
      {localAllow.length > 0 && (
        <div>
          <div className="pzl-card-title">Local Allowed ({localAllow.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {localAllow.map((perm, i) => (
              <PermissionChip key={i} text={perm} type="allow" />
            ))}
          </div>
        </div>
      )}
      {deny.length > 0 && (
        <div>
          <div className="pzl-card-title">Denied ({deny.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {deny.map((perm, i) => (
              <PermissionChip key={i} text={perm} type="deny" />
            ))}
          </div>
        </div>
      )}
      {allow.length === 0 && deny.length === 0 && localAllow.length === 0 && (
        <EmptyState text="No custom permissions configured" />
      )}
    </div>
  )
}

function PermissionChip({ text, type }: { text: string; type: 'allow' | 'deny' }) {
  const Icon = type === 'allow' ? CheckCircle2 : XCircle
  const color = type === 'allow' ? '#859900' : '#dc322f'

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
      fontWeight: 500,
      padding: '3px 8px',
      borderRadius: 3,
      border: '1px solid var(--color-border)',
      background: 'var(--color-bg-secondary)',
      color: 'var(--color-text-primary)',
    }}>
      <Icon size={11} style={{ color }} strokeWidth={2} />
      {text}
    </span>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
      {text}
    </div>
  )
}
