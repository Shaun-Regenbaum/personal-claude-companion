import { useState, useEffect, useRef } from 'react'
import { createHighlighter, type Highlighter } from 'shiki'

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['solarized-light'],
      langs: [
        'javascript', 'typescript', 'jsx', 'tsx',
        'python', 'rust', 'go', 'c', 'cpp',
        'html', 'css', 'json', 'yaml', 'toml',
        'markdown', 'bash', 'shell', 'sql',
        'swift', 'ruby', 'java', 'kotlin',
        'lua', 'zig', 'xml',
      ],
    })
  }
  return highlighterPromise
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
        // Map our language names to shiki language IDs
        const langMap: Record<string, string> = {
          typescript: 'typescript', javascript: 'javascript',
          python: 'python', rust: 'rust', go: 'go',
          c: 'c', cpp: 'cpp', html: 'html', css: 'css',
          json: 'json', yaml: 'yaml', toml: 'toml',
          markdown: 'markdown', shell: 'bash', bash: 'bash',
          sql: 'sql', swift: 'swift', ruby: 'ruby',
          java: 'java', kotlin: 'kotlin', lua: 'lua',
          zig: 'zig', xml: 'xml', jsx: 'jsx', tsx: 'tsx',
        }
        const shikiLang = langMap[langRef.current] ?? 'text'
        const loadedLangs = hl.getLoadedLanguages()

        if (loadedLangs.includes(shikiLang as never)) {
          const result = hl.codeToHtml(codeRef.current, {
            lang: shikiLang,
            theme: 'solarized-light',
          })
          if (!cancelled) setHtml(result)
        }
      } catch {
        // Fall back to plain text
      }
    })

    return () => { cancelled = true }
  }, [code, lang])

  return html
}
