// Prepare text for markdown rendering:
// - Auto-fence unfenced JSON/object blocks
// - Preserve existing code fences
export function prepareMarkdown(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let inFence = false
  let inJsonBlock = false
  let braceDepth = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trimEnd()

    // Track existing code fences
    if (trimmed.trimStart().startsWith('```')) {
      if (inJsonBlock) {
        result.push('```')
        inJsonBlock = false
        braceDepth = 0
      }
      inFence = !inFence
      result.push(line)
      continue
    }

    // Don't modify anything inside existing fences
    if (inFence) {
      result.push(line)
      continue
    }

    if (inJsonBlock) {
      // Count braces outside of quoted strings
      braceDepth += countBraceDepth(trimmed)
      result.push(line)
      if (braceDepth <= 0) {
        result.push('```')
        inJsonBlock = false
        braceDepth = 0
      }
      continue
    }

    // Detect JSON start patterns:
    // 1. Line is exactly { or [
    // 2. Line ends with { or [ (e.g. "output was: {")
    const trimmedStart = trimmed.trimStart()
    const lastChar = trimmedStart.slice(-1)

    if (lastChar === '{' || lastChar === '[') {
      // Check if this looks like a JSON block start
      // Must be either the whole line, or preceded by text (like "schema: {")
      if (trimmedStart === '{' || trimmedStart === '[') {
        // Standalone brace — fence it
        inJsonBlock = true
        braceDepth = 1
        result.push('```json')
        result.push(line)
        continue
      }

      // Line ends with { or [ — check if next lines look like JSON content
      if (looksLikeJsonStart(lines, i)) {
        // Split: text before the brace stays as markdown, brace starts a fence
        const braceIdx = trimmed.lastIndexOf(lastChar)
        const textBefore = trimmed.slice(0, braceIdx).trimEnd()
        if (textBefore) {
          result.push(textBefore)
        }
        inJsonBlock = true
        braceDepth = 1
        result.push('```json')
        result.push(lastChar)
        continue
      }
    }

    result.push(line)
  }

  if (inJsonBlock) {
    result.push('```')
  }

  return result.join('\n')
}

// Count net brace depth change in a line, ignoring braces inside quoted strings
function countBraceDepth(line: string): number {
  let depth = 0
  let inString = false
  let escaped = false

  for (const ch of line) {
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\' && inString) {
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (!inString) {
      if (ch === '{' || ch === '[') depth++
      if (ch === '}' || ch === ']') depth--
    }
  }

  return depth
}

// Check if the lines following index i look like JSON content
// (indented key-value pairs, nested braces, etc.)
function looksLikeJsonStart(lines: string[], i: number): boolean {
  // Look at the next 1-3 non-empty lines for JSON-like patterns
  let checked = 0
  for (let j = i + 1; j < lines.length && checked < 3; j++) {
    const next = lines[j].trimStart()
    if (!next) continue
    checked++
    // Looks like JSON if line starts with "key": or is an indented { or [
    if (/^"[^"]+"\s*:/.test(next)) return true
    if (/^\s+["{\[]/.test(lines[j])) return true
  }
  return false
}
