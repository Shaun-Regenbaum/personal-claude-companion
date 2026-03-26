import { useState, useMemo } from 'react'
import {
  Pencil, FileCode, BookOpen, TerminalSquare, GitCommit,
  ChevronDown, ChevronRight
} from 'lucide-react'
import { useHighlightedCode } from '../../hooks/useHighlighter.ts'
import { GitGraph } from './GitGraph.tsx'
import type { FileOperation, CommitInfo } from '../../lib/types.ts'
import { useOperations } from '../../hooks/useOperations.ts'
import { formatTimestamp } from '../../lib/format.ts'
import { generateDiff, getLanguage, shortPath } from '../../lib/diff-utils.ts'

interface DiffsViewerProps {
  sessionId: string
  initialToolUseId?: string | null
}

interface OperationGroup {
  type: 'commit' | 'ungrouped'
  commit?: CommitInfo
  operations: FileOperation[]
}

export function DiffsViewer({ sessionId, initialToolUseId }: DiffsViewerProps) {
  const { operations, commits, loading } = useOperations(sessionId)
  const [selectedId, setSelectedId] = useState<string | null>(initialToolUseId ?? null)

  // Group operations by commits, reverse chronological, uncommitted at top
  const groups = useMemo(() => {
    if (operations.length === 0) return []

    const result: OperationGroup[] = []
    const sortedCommits = [...commits].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    // Assign each operation to the next commit that follows it, or "uncommitted"
    const commitTimes = sortedCommits.map((c) => ({
      commit: c,
      time: new Date(c.timestamp).getTime(),
    }))

    // Bucket operations: for each commit, collect ops that happened before it
    // but after the previous commit
    const uncommitted: FileOperation[] = []
    const commitBuckets = new Map<string, FileOperation[]>()
    for (const c of sortedCommits) commitBuckets.set(c.hash, [])

    for (const op of operations) {
      const opTime = new Date(op.timestamp).getTime()
      // Find the earliest commit that comes after this operation
      let assigned = false
      for (let i = commitTimes.length - 1; i >= 0; i--) {
        if (opTime <= commitTimes[i].time) {
          commitBuckets.get(commitTimes[i].commit.hash)!.push(op)
          assigned = true
          break
        }
      }
      if (!assigned) {
        uncommitted.push(op)
      }
    }

    // Uncommitted first
    if (uncommitted.length > 0) {
      result.push({ type: 'ungrouped', operations: uncommitted })
    }

    // Then commits in reverse chronological order
    for (const c of sortedCommits) {
      const ops = commitBuckets.get(c.hash)!
      if (ops.length > 0) {
        result.push({ type: 'commit', commit: c, operations: ops })
      }
    }

    return result
  }, [operations, commits])

  // Find selected operation
  const selectedOp = useMemo(() =>
    operations.find((op) => op.toolUseId === selectedId) ?? null
  , [operations, selectedId])

  // Auto-select first edit/write if nothing selected
  const effectiveOp = selectedOp ?? operations.find((op) => op.toolName === 'Edit' || op.toolName === 'Write') ?? null

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256, color: 'var(--color-text-muted)', fontSize: 13 }}>
        Loading file operations...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Operations sidebar */}
      <div style={{
        width: 280,
        flexShrink: 0,
        borderRight: '1px solid var(--color-border)',
        overflowY: 'auto',
      }}>
        {/* Git graph */}
        <GitGraph sessionId={sessionId} />

        <div className="pzl-card-title" style={{ padding: '12px 12px 8px' }}>
          File Operations
        </div>
        {groups.map((group, gi) => (
          <OperationGroupView
            key={gi}
            group={group}
            selectedId={effectiveOp?.toolUseId ?? null}
            onSelect={setSelectedId}
          />
        ))}
      </div>

      {/* Content viewer */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {effectiveOp ? (
          <OperationDetail op={effectiveOp} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256, color: 'var(--color-text-muted)', fontSize: 13 }}>
            {operations.length === 0 ? 'No file operations in this session' : 'Select an operation to view'}
          </div>
        )}
      </div>
    </div>
  )
}

function OperationGroupView({ group, selectedId, onSelect }: {
  group: OperationGroup
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)

  // Only show file-related operations in the sidebar (skip Bash unless it's a commit)
  const fileOps = group.operations.filter((op) => op.toolName !== 'Bash' || op.command?.includes('git'))

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Group header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          background: 'var(--color-bg-tertiary)',
          border: 'none',
          borderBottom: '1px solid var(--color-border)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        <GitCommit size={12} style={{
          color: group.commit ? '#dc322f' : '#b58900',
          flexShrink: 0,
        }} strokeWidth={2} />
        {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {group.commit
              ? (group.commit.message || group.commit.hash.slice(0, 7))
              : 'Uncommitted'}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--color-text-muted)',
            flexShrink: 0,
          }}>
            {fileOps.length}
          </span>
        </button>

      {!collapsed && fileOps.map((op) => (
        <OperationRow
          key={op.toolUseId}
          op={op}
          isSelected={selectedId === op.toolUseId}
          onSelect={() => onSelect(op.toolUseId)}
        />
      ))}
    </div>
  )
}

const TOOL_ICON = {
  Edit: { icon: Pencil, color: '#859900' },
  Write: { icon: FileCode, color: '#859900' },
  Read: { icon: BookOpen, color: '#268bd2' },
  Bash: { icon: TerminalSquare, color: '#cb4b16' },
} as Record<string, { icon: typeof Pencil; color: string }>

function OperationRow({ op, isSelected, onSelect }: {
  op: FileOperation
  isSelected: boolean
  onSelect: () => void
}) {
  const tool = TOOL_ICON[op.toolName] ?? TOOL_ICON.Bash
  const Icon = tool.icon

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        cursor: 'pointer',
        borderLeft: isSelected ? '2px solid var(--color-accent)' : '2px solid transparent',
        background: isSelected ? 'var(--color-bg-secondary)' : 'transparent',
      }}
      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--color-bg-tertiary)' }}
      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
    >
      <Icon size={12} style={{ color: tool.color, flexShrink: 0 }} strokeWidth={2} />
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 600,
        color: tool.color,
        flexShrink: 0,
        width: 32,
      }}>
        {op.toolName}
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 500,
        color: 'var(--color-text-primary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: 1,
      }}>
        {op.filePath ? shortPath(op.filePath) : (op.commandDescription ?? op.command?.slice(0, 40) ?? '')}
      </span>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--color-text-muted)',
        flexShrink: 0,
      }}>
        {formatTimestamp(op.timestamp)}
      </span>
    </div>
  )
}

function OperationDetail({ op }: { op: FileOperation }) {
  const lang = op.filePath ? getLanguage(op.filePath) : 'text'

  return (
    <div style={{ padding: '12px 0' }}>
      {/* File header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 20px 12px',
        borderBottom: '1px solid var(--color-border)',
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-text-primary)',
        }}>
          {op.filePath || op.commandDescription || 'Bash command'}
        </span>
        <span className="pzl-badge" style={{
          fontSize: 9,
          padding: '1px 6px',
          background: 'var(--color-bg-tertiary)',
          color: 'var(--color-text-muted)',
          borderRadius: 2,
        }}>
          {op.toolName}
        </span>
        {lang !== 'text' && (
          <span className="pzl-badge" style={{
            fontSize: 9,
            padding: '1px 6px',
            background: 'var(--color-bg-tertiary)',
            color: 'var(--color-text-muted)',
            borderRadius: 2,
          }}>
            {lang}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '0 20px' }}>
        {op.toolName === 'Edit' && op.oldString != null && op.newString != null ? (
          <DiffView filePath={op.filePath} oldStr={op.oldString} newStr={op.newString} />
        ) : op.toolName === 'Bash' ? (
          <BashView command={op.command ?? ''} output={op.output ?? ''} />
        ) : (
          <CodeView content={op.content ?? op.readContent ?? ''} lang={lang} />
        )}
      </div>
    </div>
  )
}

function DiffView({ filePath, oldStr, newStr }: { filePath: string; oldStr: string; newStr: string }) {
  const lines = useMemo(() => generateDiff(filePath, oldStr, newStr), [filePath, oldStr, newStr])

  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      lineHeight: 1.6,
      marginTop: 12,
      border: '1px solid var(--color-border)',
      borderRadius: 4,
      overflow: 'auto',
    }}>
      {lines.map((line, i) => {
        if (line.type === 'header') {
          return (
            <div key={i} style={{
              padding: '4px 12px',
              background: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-muted)',
              fontSize: 11,
              fontWeight: 600,
              borderBottom: '1px solid var(--color-border)',
            }}>
              {line.content}
            </div>
          )
        }

        const bg = line.type === 'add' ? 'var(--color-diff-add-bg)'
          : line.type === 'remove' ? 'var(--color-diff-remove-bg)'
          : 'transparent'
        const color = line.type === 'add' ? 'var(--color-diff-add-text)'
          : line.type === 'remove' ? 'var(--color-diff-remove-text)'
          : 'var(--color-text-primary)'
        const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '

        return (
          <div key={i} style={{
            display: 'flex',
            background: bg,
            minHeight: 20,
          }}>
            <span style={{
              width: 44,
              flexShrink: 0,
              textAlign: 'right',
              paddingRight: 8,
              color: 'var(--color-text-muted)',
              fontSize: 11,
              userSelect: 'none',
              borderRight: '1px solid var(--color-border)',
            }}>
              {line.lineNum ?? ''}
            </span>
            <span style={{
              width: 16,
              flexShrink: 0,
              textAlign: 'center',
              color,
              fontWeight: 600,
              userSelect: 'none',
            }}>
              {prefix}
            </span>
            <span style={{
              flex: 1,
              color,
              fontWeight: 500,
              whiteSpace: 'pre',
              paddingRight: 12,
            }}>
              {line.content}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function CodeView({ content, lang }: { content: string; lang: string }) {
  const html = useHighlightedCode(content, lang)
  const lines = content.split('\n')

  // If shiki produced highlighted HTML, render it with line numbers
  if (html) {
    return (
      <div style={{
        marginTop: 12,
        border: '1px solid var(--color-border)',
        borderRadius: 4,
        overflow: 'auto',
        maxHeight: '70vh',
        display: 'flex',
      }}>
        {/* Line numbers gutter */}
        <div style={{
          flexShrink: 0,
          borderRight: '1px solid var(--color-border)',
          background: 'var(--color-bg-secondary)',
          padding: '12px 0',
          userSelect: 'none',
          textAlign: 'right',
        }}>
          {lines.map((_, i) => (
            <div key={i} style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              lineHeight: 1.6,
              paddingRight: 8,
              paddingLeft: 8,
              color: 'var(--color-text-muted)',
              minWidth: 36,
            }}>
              {i + 1}
            </div>
          ))}
        </div>
        {/* Highlighted code */}
        <div
          className="shiki-container"
          style={{ flex: 1, overflow: 'auto' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    )
  }

  // Fallback: plain monospace
  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      lineHeight: 1.6,
      marginTop: 12,
      border: '1px solid var(--color-border)',
      borderRadius: 4,
      overflow: 'auto',
      maxHeight: '70vh',
    }}>
      {lines.map((line, i) => (
        <div key={i} style={{ display: 'flex', minHeight: 20 }}>
          <span style={{
            width: 44,
            flexShrink: 0,
            textAlign: 'right',
            paddingRight: 8,
            color: 'var(--color-text-muted)',
            fontSize: 11,
            userSelect: 'none',
            borderRight: '1px solid var(--color-border)',
            background: 'var(--color-bg-secondary)',
          }}>
            {i + 1}
          </span>
          <span style={{
            flex: 1,
            paddingLeft: 12,
            paddingRight: 12,
            color: 'var(--color-text-primary)',
            fontWeight: 500,
            whiteSpace: 'pre',
          }}>
            {line}
          </span>
        </div>
      ))}
    </div>
  )
}

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '').replace(/\[[\d;]*m/g, '')
}

function BashView({ command, output }: { command: string; output: string }) {
  const cleanOutput = stripAnsi(output)
  const lines = cleanOutput.split('\n')

  return (
    <div style={{ marginTop: 12 }}>
      {/* Command */}
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        fontWeight: 600,
        padding: '8px 12px',
        background: 'var(--color-bg-tertiary)',
        border: '1px solid var(--color-border)',
        borderRadius: '4px 4px 0 0',
        color: '#cb4b16',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}>
        $ {command}
      </div>
      {/* Output with line numbers */}
      {cleanOutput && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          border: '1px solid var(--color-border)',
          borderTop: 'none',
          borderRadius: '0 0 4px 4px',
          maxHeight: '60vh',
          overflow: 'auto',
        }}>
          {lines.map((line, i) => (
            <div key={i} style={{ display: 'flex', minHeight: 19 }}>
              <span style={{
                width: 36,
                flexShrink: 0,
                textAlign: 'right',
                paddingRight: 8,
                color: 'var(--color-text-muted)',
                fontSize: 10,
                userSelect: 'none',
                borderRight: '1px solid var(--color-border)',
                background: 'var(--color-bg-secondary)',
                lineHeight: 1.6,
              }}>
                {i + 1}
              </span>
              <span style={{
                flex: 1,
                paddingLeft: 10,
                paddingRight: 12,
                color: line.startsWith('error') || line.startsWith('Error') ? '#dc322f'
                  : line.startsWith('warning') || line.startsWith('Warning') ? '#b58900'
                  : line.startsWith('+') ? '#859900'
                  : line.startsWith('-') ? '#dc322f'
                  : 'var(--color-text-secondary)',
                fontWeight: 500,
                whiteSpace: 'pre',
                lineHeight: 1.6,
              }}>
                {line}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
