import { useState, useEffect } from 'react'
import { GitBranch, GitCommit as GitCommitIcon } from 'lucide-react'
import { api } from '../../lib/api.ts'
import { relativeTime } from '../../lib/format.ts'

interface GitGraphProps {
  sessionId: string
}

interface GitLogEntry {
  hash: string
  shortHash: string
  message: string
  author: string
  date: string
  refs: string
}

export function GitGraph({ sessionId }: GitGraphProps) {
  const [entries, setEntries] = useState<GitLogEntry[]>([])
  const [graph, setGraph] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.getGitLog(sessionId, 8)
      .then((data) => {
        setEntries(data.entries)
        setGraph(data.graph)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) return null
  if (entries.length === 0) return null

  return (
    <div style={{
      borderBottom: '1px solid var(--color-border)',
      padding: '10px 12px',
    }}>
      <div className="pzl-card-title" style={{ marginBottom: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <GitBranch size={11} strokeWidth={2} /> Git
        </span>
      </div>

      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        lineHeight: 1.5,
      }}>
        {graph.split('\n').filter(Boolean).map((line, i) => {
          const entry = entries[i]
          // Extract graph characters (before the hash)
          const graphMatch = line.match(/^([*|/\\ ]+)/)
          const graphPart = graphMatch?.[1] ?? ''

          return (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 0,
              minHeight: 18,
            }}>
              {/* Graph characters */}
              <span style={{
                color: graphPart.includes('*') ? '#859900' : 'var(--color-text-muted)',
                fontWeight: 600,
                whiteSpace: 'pre',
                flexShrink: 0,
                width: Math.max(graphPart.length * 7.2, 16),
              }}>
                {graphPart}
              </span>

              {entry ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                }}>
                  {/* Hash */}
                  <span style={{
                    color: '#cb4b16',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}>
                    {entry.shortHash}
                  </span>

                  {/* Refs (branches/tags) */}
                  {entry.refs && (
                    <span style={{
                      fontSize: 9,
                      fontWeight: 600,
                      padding: '0 4px',
                      borderRadius: 2,
                      background: '#268bd220',
                      color: '#268bd2',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}>
                      {entry.refs.split(',').map(r => r.trim().replace('HEAD -> ', '')).join(', ')}
                    </span>
                  )}

                  {/* Message */}
                  <span style={{
                    color: 'var(--color-text-primary)',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}>
                    {entry.message}
                  </span>

                  {/* Time */}
                  <span style={{
                    color: 'var(--color-text-muted)',
                    flexShrink: 0,
                    fontSize: 10,
                  }}>
                    {relativeTime(new Date(entry.date).getTime())}
                  </span>
                </div>
              ) : (
                <span style={{
                  color: 'var(--color-text-muted)',
                  whiteSpace: 'pre',
                }}>
                  {line.slice(graphPart.length)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
