import { useState } from 'react'
import {
  Server, Puzzle, Zap, Wrench, Shield,
  ChevronDown, ChevronRight, CheckCircle2, XCircle
} from 'lucide-react'
import { useConfig } from '../../hooks/useConfig.ts'
import { relativeTime } from '../../lib/format.ts'
import type { McpServerInfo, PluginInfo, SkillInfo, HookInfo } from '../../lib/types.ts'

type Section = 'mcp' | 'plugins' | 'skills' | 'hooks' | 'permissions'

const SECTIONS: { id: Section; label: string; icon: typeof Server }[] = [
  { id: 'mcp', label: 'MCP Servers', icon: Server },
  { id: 'plugins', label: 'Plugins', icon: Puzzle },
  { id: 'skills', label: 'Skills', icon: Wrench },
  { id: 'hooks', label: 'Hooks', icon: Zap },
  { id: 'permissions', label: 'Permissions', icon: Shield },
]

export function ConfigViewer() {
  const { config, loading } = useConfig()
  const [activeSection, setActiveSection] = useState<Section>('mcp')

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
        <div className="pzl-card-title" style={{ padding: '0 12px 8px' }}>Config</div>
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
        {activeSection === 'mcp' && <McpSection servers={config.mcpServers} />}
        {activeSection === 'plugins' && <PluginsSection plugins={config.plugins} />}
        {activeSection === 'skills' && <SkillsSection skills={config.skills} />}
        {activeSection === 'hooks' && <HooksSection hooks={config.hooks} />}
        {activeSection === 'permissions' && <PermissionsSection settings={config.settings} localSettings={config.localSettings} />}
      </div>
    </div>
  )
}

function McpSection({ servers }: { servers: McpServerInfo[] }) {
  if (servers.length === 0) return <EmptyState text="No MCP servers configured" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {servers.map((server) => (
        <div key={server.name} className="pzl-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Server size={14} style={{ color: server.enabled ? '#859900' : 'var(--color-text-muted)' }} strokeWidth={2} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {server.name}
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
          </div>
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

function PluginsSection({ plugins }: { plugins: PluginInfo[] }) {
  if (plugins.length === 0) return <EmptyState text="No plugins installed" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {plugins.map((plugin, i) => (
        <div key={`${plugin.name}-${i}`} className="pzl-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Puzzle size={14} style={{ color: '#6c71c4' }} strokeWidth={2} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
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

function SkillsSection({ skills }: { skills: SkillInfo[] }) {
  if (skills.length === 0) return <EmptyState text="No skills configured" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {skills.map((skill) => (
        <div key={skill.name} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          border: '1px solid var(--color-border)',
          borderRadius: 4,
          background: 'var(--color-bg-secondary)',
        }}>
          <Wrench size={13} style={{ color: '#2aa198', flexShrink: 0 }} strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            {skill.name}
          </span>
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
        </div>
      ))}
    </div>
  )
}

function HooksSection({ hooks }: { hooks: HookInfo[] }) {
  if (hooks.length === 0) return <EmptyState text="No hooks configured" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {hooks.map((hook, i) => (
        <div key={i} className="pzl-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Zap size={14} style={{ color: '#b58900' }} strokeWidth={2} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
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
            <span style={{
              fontSize: 9,
              color: 'var(--color-text-muted)',
              marginLeft: 'auto',
            }}>
              {hook.source}
            </span>
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
      ))}
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
