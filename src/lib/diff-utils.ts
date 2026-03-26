import { createPatch } from 'diff'

export interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header'
  content: string
  lineNum?: number
}

export function generateDiff(filePath: string, oldStr: string, newStr: string): DiffLine[] {
  const patch = createPatch(filePath, oldStr, newStr, '', '', { context: 3 })
  const lines = patch.split('\n')
  const result: DiffLine[] = []

  let oldLine = 0
  let newLine = 0

  for (const line of lines) {
    // Skip file headers
    if (line.startsWith('Index:') || line.startsWith('===') || line.startsWith('---') || line.startsWith('+++')) {
      continue
    }
    if (line.startsWith('@@')) {
      result.push({ type: 'header', content: line })
      const match = line.match(/@@ -(\d+)/)
      if (match) {
        oldLine = parseInt(match[1], 10)
        newLine = parseInt(match[1], 10)
      }
      continue
    }
    if (line.startsWith('+')) {
      result.push({ type: 'add', content: line.slice(1), lineNum: newLine++ })
    } else if (line.startsWith('-')) {
      result.push({ type: 'remove', content: line.slice(1), lineNum: oldLine++ })
    } else if (line.startsWith(' ')) {
      result.push({ type: 'context', content: line.slice(1), lineNum: newLine })
      oldLine++
      newLine++
    }
  }

  return result
}

/**
 * Guess language from file extension for display purposes.
 */
export function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', go: 'go', rb: 'ruby', java: 'java',
    css: 'css', html: 'html', json: 'json', yaml: 'yaml', yml: 'yaml',
    md: 'markdown', sh: 'shell', bash: 'shell', zsh: 'shell',
    sql: 'sql', toml: 'toml', lua: 'lua', zig: 'zig', c: 'c', h: 'c',
    cpp: 'cpp', hpp: 'cpp', swift: 'swift', kt: 'kotlin',
    csv: 'csv', xml: 'xml', svg: 'xml',
  }
  return map[ext] ?? 'text'
}

export function shortPath(filePath: string): string {
  if (!filePath) return ''
  const parts = filePath.split('/')
  if (parts.length <= 3) return filePath
  return '.../' + parts.slice(-3).join('/')
}
