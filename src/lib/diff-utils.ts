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
  // Handle special filenames first
  const basename = filePath.split('/').pop()?.toLowerCase() ?? ''
  const basenameMap: Record<string, string> = {
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    cmakelists: 'cmake',
    '.gitignore': 'shell',
    '.env': 'shell',
    '.env.local': 'shell',
    '.env.example': 'shell',
    '.editorconfig': 'ini',
    '.prettierrc': 'json',
    '.eslintrc': 'json',
    'tsconfig.json': 'jsonc',
    'jsconfig.json': 'jsonc',
  }
  if (basenameMap[basename]) return basenameMap[basename]

  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    // Web
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    mjs: 'javascript', mts: 'typescript', cjs: 'javascript', cts: 'typescript',
    css: 'css', scss: 'scss', less: 'less',
    html: 'html', htm: 'html',
    vue: 'vue', svelte: 'svelte', astro: 'astro',
    json: 'json', jsonc: 'jsonc', jsonl: 'json',
    gql: 'graphql', graphql: 'graphql',
    // Systems
    rs: 'rust', go: 'go', c: 'c', h: 'c',
    cpp: 'cpp', hpp: 'cpp', cc: 'cpp', cxx: 'cpp',
    zig: 'zig', swift: 'swift',
    // Scripting
    py: 'python', pyi: 'python', pyx: 'python',
    rb: 'ruby', lua: 'lua',
    r: 'r', R: 'r', jl: 'julia',
    sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
    ps1: 'powershell',
    pl: 'perl', pm: 'perl', php: 'php',
    // JVM
    java: 'java', kt: 'kotlin', kts: 'kotlin',
    scala: 'scala', groovy: 'groovy', gradle: 'groovy',
    // Functional
    ex: 'elixir', exs: 'elixir', erl: 'erlang',
    hs: 'haskell', ml: 'ocaml', mli: 'ocaml',
    dart: 'dart',
    // Data/Config
    yaml: 'yaml', yml: 'yaml',
    toml: 'toml', ini: 'ini', cfg: 'ini',
    properties: 'properties',
    sql: 'sql', csv: 'csv',
    xml: 'xml', svg: 'svg', xsl: 'xml',
    md: 'markdown', mdx: 'markdown',
    // Infra
    tf: 'hcl', hcl: 'hcl',
    proto: 'proto',
    nginx: 'nginx', conf: 'nginx',
    cmake: 'cmake',
    // Other
    diff: 'diff', patch: 'diff',
    lock: 'json',
    env: 'shell',
    gitignore: 'shell',
    editorconfig: 'ini',
  }
  return map[ext] ?? 'text'
}

export function shortPath(filePath: string): string {
  if (!filePath) return ''
  const parts = filePath.split('/')
  if (parts.length <= 3) return filePath
  return '.../' + parts.slice(-3).join('/')
}
