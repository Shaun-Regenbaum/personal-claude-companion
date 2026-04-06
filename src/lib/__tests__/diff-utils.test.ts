import { describe, it, expect } from 'vitest'
import { generateDiff, getLanguage, shortPath } from '../diff-utils'

describe('getLanguage', () => {
  describe('file extensions', () => {
    it.each([
      ['file.ts', 'typescript'],
      ['file.tsx', 'tsx'],
      ['file.js', 'javascript'],
      ['file.jsx', 'jsx'],
      ['file.mjs', 'javascript'],
      ['file.mts', 'typescript'],
      ['file.py', 'python'],
      ['file.rs', 'rust'],
      ['file.go', 'go'],
      ['file.c', 'c'],
      ['file.h', 'c'],
      ['file.cpp', 'cpp'],
      ['file.css', 'css'],
      ['file.scss', 'scss'],
      ['file.html', 'html'],
      ['file.json', 'json'],
      ['file.jsonl', 'json'],
      ['file.yaml', 'yaml'],
      ['file.yml', 'yaml'],
      ['file.toml', 'toml'],
      ['file.sql', 'sql'],
      ['file.sh', 'shell'],
      ['file.bash', 'shell'],
      ['file.rb', 'ruby'],
      ['file.java', 'java'],
      ['file.kt', 'kotlin'],
      ['file.swift', 'swift'],
      ['file.zig', 'zig'],
      ['file.md', 'markdown'],
      ['file.diff', 'diff'],
      ['file.tf', 'hcl'],
      ['file.proto', 'proto'],
      ['file.ex', 'elixir'],
      ['file.hs', 'haskell'],
      ['file.dart', 'dart'],
      ['file.php', 'php'],
    ])('%s -> %s', (path, expected) => {
      expect(getLanguage(path)).toBe(expected)
    })
  })

  describe('special filenames', () => {
    it.each([
      ['Dockerfile', 'dockerfile'],
      ['Makefile', 'makefile'],
      ['.gitignore', 'shell'],
      ['.env', 'shell'],
      ['.env.local', 'shell'],
      ['tsconfig.json', 'jsonc'],
      ['.prettierrc', 'json'],
      ['.eslintrc', 'json'],
      ['.editorconfig', 'ini'],
    ])('%s -> %s', (path, expected) => {
      expect(getLanguage(path)).toBe(expected)
    })
  })

  it('returns "text" for unknown extensions', () => {
    expect(getLanguage('file.xyz')).toBe('text')
  })

  it('handles paths with directories', () => {
    expect(getLanguage('src/components/App.tsx')).toBe('tsx')
  })
})

describe('shortPath', () => {
  it('returns empty string for empty input', () => {
    expect(shortPath('')).toBe('')
  })

  it('returns short paths unchanged', () => {
    expect(shortPath('src/file.ts')).toBe('src/file.ts')
  })

  it('returns 3-segment paths unchanged', () => {
    expect(shortPath('a/b/c')).toBe('a/b/c')
  })

  it('abbreviates long paths', () => {
    expect(shortPath('a/b/c/d/e.ts')).toBe('.../c/d/e.ts')
  })

  it('abbreviates deeply nested paths', () => {
    expect(shortPath('/Users/name/code/project/src/lib/utils.ts')).toBe('.../src/lib/utils.ts')
  })
})

describe('generateDiff', () => {
  it('returns empty for identical content', () => {
    const result = generateDiff('file.ts', 'hello', 'hello')
    expect(result).toEqual([])
  })

  it('detects additions', () => {
    const result = generateDiff('file.ts', '', 'new line')
    const adds = result.filter((l) => l.type === 'add')
    expect(adds.length).toBeGreaterThan(0)
    expect(adds[0].content).toBe('new line')
  })

  it('detects removals', () => {
    const result = generateDiff('file.ts', 'old line', '')
    const removes = result.filter((l) => l.type === 'remove')
    expect(removes.length).toBeGreaterThan(0)
    expect(removes[0].content).toBe('old line')
  })

  it('detects modifications', () => {
    const result = generateDiff('file.ts', 'line one\nline two', 'line one\nline changed')
    const adds = result.filter((l) => l.type === 'add')
    const removes = result.filter((l) => l.type === 'remove')
    expect(adds.length).toBeGreaterThan(0)
    expect(removes.length).toBeGreaterThan(0)
  })

  it('includes hunk headers', () => {
    const result = generateDiff('file.ts', 'old', 'new')
    const headers = result.filter((l) => l.type === 'header')
    expect(headers.length).toBeGreaterThan(0)
    expect(headers[0].content).toMatch(/^@@/)
  })

  it('includes context lines', () => {
    const old = 'line 1\nline 2\nline 3\nline 4\nline 5'
    const nw = 'line 1\nline 2\nchanged\nline 4\nline 5'
    const result = generateDiff('file.ts', old, nw)
    const context = result.filter((l) => l.type === 'context')
    expect(context.length).toBeGreaterThan(0)
  })
})
