import { useState, useEffect, useRef } from 'react'
import { createHighlighter, type Highlighter } from 'shiki'

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['solarized-light'],
      langs: [
        // Web
        'javascript', 'typescript', 'jsx', 'tsx',
        'html', 'css', 'scss', 'less', 'json', 'jsonc',
        'vue', 'svelte', 'astro', 'xml', 'graphql',
        // Systems
        'rust', 'go', 'c', 'cpp', 'zig', 'swift',
        // Scripting
        'python', 'ruby', 'lua', 'r', 'julia',
        'bash', 'shell', 'powershell',
        // JVM
        'java', 'kotlin', 'scala', 'groovy',
        // Data/Config
        'yaml', 'toml', 'ini', 'properties',
        'sql', 'csv', 'markdown',
        // Infra
        'dockerfile', 'makefile', 'hcl', 'terraform',
        'nginx', 'cmake',
        // Other
        'diff', 'regex', 'proto',
        'elixir', 'erlang', 'haskell', 'ocaml',
        'dart', 'php', 'perl',
      ],
    })
  }
  return highlighterPromise
}

// Map our language identifiers to shiki language IDs
const LANG_MAP: Record<string, string> = {
  typescript: 'typescript', javascript: 'javascript',
  jsx: 'jsx', tsx: 'tsx',
  python: 'python', rust: 'rust', go: 'go',
  c: 'c', cpp: 'cpp', zig: 'zig', swift: 'swift',
  html: 'html', css: 'css', scss: 'scss', less: 'less',
  json: 'json', jsonc: 'jsonc',
  xml: 'xml', svg: 'xml', graphql: 'graphql',
  vue: 'vue', svelte: 'svelte', astro: 'astro',
  yaml: 'yaml', toml: 'toml', ini: 'ini', properties: 'properties',
  markdown: 'markdown',
  shell: 'bash', bash: 'bash', powershell: 'powershell',
  sql: 'sql', csv: 'csv',
  ruby: 'ruby', lua: 'lua', r: 'r', julia: 'julia',
  java: 'java', kotlin: 'kotlin', scala: 'scala', groovy: 'groovy',
  dockerfile: 'dockerfile', makefile: 'makefile',
  hcl: 'hcl', terraform: 'terraform',
  nginx: 'nginx', cmake: 'cmake',
  diff: 'diff', regex: 'regex', proto: 'proto',
  elixir: 'elixir', erlang: 'erlang', haskell: 'haskell', ocaml: 'ocaml',
  dart: 'dart', php: 'php', perl: 'perl',
}

export function useHighlightedCode(code: string, lang: string): string {
  const [html, setHtml] = useState('')
  const codeRef = useRef(code)
  const langRef = useRef(lang)
  codeRef.current = code
  langRef.current = lang

  useEffect(() => {
    let cancelled = false

    getHighlighter().then((hl) => {
      if (cancelled) return
      try {
        const shikiLang = LANG_MAP[langRef.current]
        if (!shikiLang) return // Unknown language, skip highlighting

        const result = hl.codeToHtml(codeRef.current, {
          lang: shikiLang,
          theme: 'solarized-light',
        })
        if (!cancelled) setHtml(result)
      } catch {
        // Fall back to plain text
      }
    })

    return () => { cancelled = true }
  }, [code, lang])

  return html
}
