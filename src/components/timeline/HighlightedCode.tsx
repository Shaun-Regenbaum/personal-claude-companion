import type { ComponentPropsWithoutRef } from 'react'
import { useHighlightedCode } from '../../hooks/useHighlighter.ts'

type CodeProps = ComponentPropsWithoutRef<'code'>

export function HighlightedCode({ children, className, ...props }: CodeProps) {
  // ReactMarkdown passes className="language-xxx" for fenced code blocks
  const match = className?.match(/language-(\w+)/)
  const lang = match ? match[1] : ''
  const code = String(children).replace(/\n$/, '')

  // Only highlight fenced code blocks (inside <pre>), not inline code
  const isBlock = Boolean(className)

  if (!isBlock) {
    return <code className={className} {...props}>{children}</code>
  }

  return <ShikiBlock code={code} lang={lang} />
}

function ShikiBlock({ code, lang }: { code: string; lang: string }) {
  const html = useHighlightedCode(code, lang)

  if (html) {
    return (
      <div
        className="shiki-container"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }

  // Fallback while loading or for unknown languages
  return <code>{code}</code>
}
