import { useState } from 'react'
import {
  Pencil, FileText, BookOpen, TerminalSquare, Search,
  FolderSearch, Bot, Globe, Download, FileCode, GitCommit
} from 'lucide-react'
import type { ComponentType } from 'react'

// Muted solarized-compatible icon colors (not full gruvbox saturation)
const TOOL_STYLES: Record<string, { icon: ComponentType<{ size?: number; style?: React.CSSProperties; strokeWidth?: number }>; color: string; label: string }> = {
  Edit:      { icon: Pencil,         color: '#859900', label: 'Edit' },
  Write:     { icon: FileCode,       color: '#859900', label: 'Write' },
  Read:      { icon: BookOpen,       color: '#268bd2', label: 'Read' },
  Bash:      { icon: TerminalSquare, color: '#cb4b16', label: 'Bash' },
  Grep:      { icon: Search,         color: '#6c71c4', label: 'Grep' },
  Glob:      { icon: FolderSearch,   color: '#6c71c4', label: 'Glob' },
  Agent:     { icon: Bot,            color: '#b58900', label: 'Agent' },
  WebSearch: { icon: Globe,          color: '#2aa198', label: 'Search' },
  WebFetch:  { icon: Download,       color: '#2aa198', label: 'Fetch' },
  Commit:    { icon: GitCommit,      color: '#dc322f', label: 'Commit' },
}

const DEFAULT_STYLE = { icon: FileText, color: '#657b83', label: 'Tool' }

interface ToolCallBlockProps {
  name: string
  toolUseId?: string
  input: Record<string, unknown>
  result?: string
  onNavigate?: (toolUseId: string) => void
}

export function ToolCallBlock({ name, toolUseId, input, result, onNavigate }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const style = TOOL_STYLES[name] ?? DEFAULT_STYLE
  const Icon = style.icon
  const summary = getToolSummary(name, input)
  const canNavigate = onNavigate && toolUseId && ['Edit', 'Write', 'Read', 'Bash'].includes(name)

  return (
    <div style={{ borderLeft: `2px solid ${style.color}30` }}>
      {/* Compact single-line row */}
      <button
        onClick={() => canNavigate ? onNavigate(toolUseId) : setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 8px 3px 10px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-tertiary)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <Icon size={13} style={{ color: style.color, flexShrink: 0 }} strokeWidth={2} />
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          fontWeight: 600,
          color: style.color,
          flexShrink: 0,
          width: 48,
        }}>
          {style.label}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--color-text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {summary}
        </span>
        {(name === 'Edit' || name === 'Write') && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--color-text-muted)',
            flexShrink: 0,
          }}>
            {getEditStats(name, input)}
          </span>
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '4px 8px 8px 28px' }}>
          <pre style={{
            fontFamily: 'var(--font-mono)',
            background: 'var(--color-bg-secondary)',
            padding: 10,
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            overflow: 'auto',
            maxHeight: 240,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            color: 'var(--color-text-secondary)',
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.5,
          }}>
            {formatInput(name, input)}
          </pre>

          {result && (
            <pre style={{
              fontFamily: 'var(--font-mono)',
              background: 'var(--color-bg-secondary)',
              padding: 10,
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              overflow: 'auto',
              maxHeight: 200,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              color: 'var(--color-text-muted)',
              fontSize: 12,
              fontWeight: 500,
              lineHeight: 1.5,
              marginTop: 4,
            }}>
              {result.slice(0, 2000)}{result.length > 2000 ? '\n...' : ''}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function getToolSummary(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'Edit': return shortPath(input.file_path as string)
    case 'Write': return shortPath(input.file_path as string)
    case 'Read': return shortPath(input.file_path as string)
    case 'Bash': return (input.description as string) ?? (input.command as string)?.slice(0, 80) ?? ''
    case 'Grep': return `"${input.pattern}" ${shortPath(input.path as string)}`
    case 'Glob': return (input.pattern as string) ?? ''
    case 'Agent': return (input.description as string) ?? ''
    case 'WebSearch': return (input.query as string) ?? ''
    default: return ''
  }
}

function getEditStats(name: string, input: Record<string, unknown>): string {
  if (name === 'Edit') {
    const oldLen = ((input.old_string as string) ?? '').split('\n').length
    const newLen = ((input.new_string as string) ?? '').split('\n').length
    return `+${newLen} -${oldLen}`
  }
  if (name === 'Write') {
    const lines = ((input.content as string) ?? '').split('\n').length
    return `${lines}L`
  }
  return ''
}

function shortPath(path: string | undefined): string {
  if (!path) return ''
  const parts = path.split('/')
  if (parts.length <= 3) return path
  return '.../' + parts.slice(-3).join('/')
}

function formatInput(name: string, input: Record<string, unknown>): string {
  if (name === 'Edit') {
    return `${input.file_path}\n\n--- old ---\n${input.old_string ?? ''}\n\n+++ new +++\n${input.new_string ?? ''}`
  }
  if (name === 'Bash') return (input.command as string) ?? JSON.stringify(input, null, 2)
  if (name === 'Write') {
    const content = (input.content as string) ?? ''
    return `${input.file_path}\n\n${content.slice(0, 2000)}${content.length > 2000 ? '\n...' : ''}`
  }
  if (name === 'Agent') {
    const desc = (input.description as string) ?? ''
    const type = (input.subagent_type as string) ?? (input.type as string) ?? ''
    const prompt = (input.prompt as string) ?? ''
    const truncatedPrompt = prompt.length > 300
      ? prompt.slice(0, 300) + '\n... (truncated)'
      : prompt
    const parts: string[] = []
    if (desc) parts.push(`Description: ${desc}`)
    if (type) parts.push(`Type: ${type}`)
    if (truncatedPrompt) parts.push(`\nPrompt:\n${truncatedPrompt}`)
    return parts.join('\n') || JSON.stringify(input, null, 2)
  }
  return JSON.stringify(input, null, 2)
}

export { TOOL_STYLES, getToolSummary, getEditStats, shortPath, formatInput }
