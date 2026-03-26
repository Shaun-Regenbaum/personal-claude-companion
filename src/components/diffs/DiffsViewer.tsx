import { useState, useMemo } from 'react'
import {
  Pencil, FileCode, BookOpen, TerminalSquare, GitCommit,
  ChevronDown, ChevronRight
} from 'lucide-react'
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

  // Group operations by commits
  const groups = useMemo(() => {
    const result: OperationGroup[] = []
    const commitsByTimestamp = new Map<string, CommitInfo>()
    for (const c of commits) commitsByTimestamp.set(c.timestamp, c)

    // Find commit boundaries
    const commitTimes = commits.map((c) => new Date(c.timestamp).getTime()).sort((a, b) => a - b)

    let currentGroup: FileOperation[] = []
    let lastCommitIdx = -1

    for (const op of operations) {
      const opTime = new Date(op.timestamp).getTime()

      // Check if a commit happened after this operation
      const nextCommitIdx = commitTimes.findIndex((ct, i) => i > lastCommitIdx && ct >= opTime)

      if (nextCommitIdx !== -1 && nextCommitIdx !== lastCommitIdx) {
        // Check if this commit's time matches
        const commitTime = commitTimes[nextCommitIdx]
        if (commitTime <= opTime + 60000) {
          // Same group
          currentGroup.push(op)
          continue
        }
      }

      currentGroup.push(op)
    }

    // Simple grouping: put edits before each commit together
    if (commits.length === 0) {
      result.push({ type: 'ungrouped', operations })
    } else {
      let ops: FileOperation[] = []
      let commitIdx = 0

      for (const op of operations) {
        const opTime = new Date(op.timestamp).getTime()

        // If there's a commit and we've passed it, close the group
        while (commitIdx < commits.length) {
          const commitTime = new Date(commits[commitIdx].timestamp).getTime()
          if (opTime > commitTime) {
            if (ops.length > 0) {
              result.push({ type: 'commit', commit: commits[commitIdx], operations: ops })
              ops = []
            }
            commitIdx++
          } else {
            break
          }
        }
        ops.push(op)
      }

      // Remaining ops
      if (ops.length > 0) {
        if (commitIdx < commits.length) {
          result.push({ type: 'commit', commit: commits[commitIdx], operations: ops })
        } else {
          result.push({ type: 'ungrouped', operations: ops })
        }
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
      {/* Commit header */}
      {group.commit && (
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
          <GitCommit size={12} style={{ color: '#dc322f', flexShrink: 0 }} strokeWidth={2} />
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
            {group.commit.message || group.commit.hash.slice(0, 7)}
          </span>
        </button>
      )}

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
        {op.toolName === 'Edit' && op.oldString != null && op.newString != null && (
          <DiffView filePath={op.filePath} oldStr={op.oldString} newStr={op.newString} />
        )}
        {op.toolName === 'Write' && op.content != null && (
          <CodeView content={op.content} lang={lang} />
        )}
        {op.toolName === 'Read' && op.readContent != null && (
          <CodeView content={op.readContent} lang={lang} />
        )}
        {op.toolName === 'Bash' && (
          <BashView command={op.command ?? ''} output={op.output ?? ''} />
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
  const lines = content.split('\n')

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

function BashView({ command, output }: { command: string; output: string }) {
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
      {/* Output */}
      {output && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          fontWeight: 500,
          padding: '8px 12px',
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderTop: 'none',
          borderRadius: '0 0 4px 4px',
          color: 'var(--color-text-secondary)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          maxHeight: '60vh',
          overflow: 'auto',
          lineHeight: 1.5,
        }}>
          {output}
        </div>
      )}
    </div>
  )
}
