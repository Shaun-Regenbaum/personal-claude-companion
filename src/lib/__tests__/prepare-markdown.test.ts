import { describe, it, expect } from 'vitest'
import { prepareMarkdown } from '../prepare-markdown'

describe('prepareMarkdown', () => {
  describe('passthrough', () => {
    it('returns plain text unchanged', () => {
      const input = 'Hello world\nThis is a test'
      expect(prepareMarkdown(input)).toBe(input)
    })

    it('preserves existing fenced code blocks', () => {
      const input = '```json\n{"key": "value"}\n```'
      expect(prepareMarkdown(input)).toBe(input)
    })

    it('preserves existing fenced code blocks with language', () => {
      const input = 'Some text\n```python\nprint("hello")\n```\nMore text'
      expect(prepareMarkdown(input)).toBe(input)
    })

    it('does not fence braces inside existing fences', () => {
      const input = '```\n{\n  "nested": {\n    "deep": true\n  }\n}\n```'
      expect(prepareMarkdown(input)).toBe(input)
    })
  })

  describe('standalone brace detection', () => {
    it('fences { on its own line', () => {
      const input = 'Output:\n{\n  "key": "value"\n}'
      const expected = 'Output:\n```json\n{\n  "key": "value"\n}\n```'
      expect(prepareMarkdown(input)).toBe(expected)
    })

    it('fences [ on its own line', () => {
      const input = 'List:\n[\n  1,\n  2\n]'
      const expected = 'List:\n```json\n[\n  1,\n  2\n]\n```'
      expect(prepareMarkdown(input)).toBe(expected)
    })

    it('handles nested braces', () => {
      const input = '{\n  "outer": {\n    "inner": true\n  }\n}'
      const expected = '```json\n{\n  "outer": {\n    "inner": true\n  }\n}\n```'
      expect(prepareMarkdown(input)).toBe(expected)
    })
  })

  describe('trailing brace detection', () => {
    it('fences when line ends with {', () => {
      const input = 'The output was: {\n  "hookEventName": "Stop"\n}'
      const expected = 'The output was:\n```json\n{\n  "hookEventName": "Stop"\n}\n```'
      expect(prepareMarkdown(input)).toBe(expected)
    })

    it('fences "Expected schema: {" pattern', () => {
      const input = 'Expected schema: {\n  "continue": "boolean"\n}'
      const expected = 'Expected schema:\n```json\n{\n  "continue": "boolean"\n}\n```'
      expect(prepareMarkdown(input)).toBe(expected)
    })
  })

  describe('brace depth tracking', () => {
    it('tracks deeply nested braces', () => {
      const input = '{\n  "a": {\n    "b": {\n      "c": true\n    }\n  }\n}'
      const expected = '```json\n{\n  "a": {\n    "b": {\n      "c": true\n    }\n  }\n}\n```'
      expect(prepareMarkdown(input)).toBe(expected)
    })

    it('ignores braces inside quoted strings', () => {
      const input = '{\n  "pattern": "use {x} here",\n  "value": true\n}'
      const expected = '```json\n{\n  "pattern": "use {x} here",\n  "value": true\n}\n```'
      expect(prepareMarkdown(input)).toBe(expected)
    })

    it('auto-closes unclosed brace blocks', () => {
      const input = '{\n  "key": "value"'
      const expected = '```json\n{\n  "key": "value"\n```'
      expect(prepareMarkdown(input)).toBe(expected)
    })
  })

  describe('mixed content', () => {
    it('handles markdown with embedded JSON', () => {
      const input = '**Bold text**\n\nHere is the config:\n{\n  "debug": true\n}\n\nAnd more text.'
      const expected = '**Bold text**\n\nHere is the config:\n```json\n{\n  "debug": true\n}\n```\n\nAnd more text.'
      expect(prepareMarkdown(input)).toBe(expected)
    })

    it('handles multiple JSON blocks', () => {
      const input = 'First:\n{\n  "a": 1\n}\n\nSecond:\n{\n  "b": 2\n}'
      const expected = 'First:\n```json\n{\n  "a": 1\n}\n```\n\nSecond:\n```json\n{\n  "b": 2\n}\n```'
      expect(prepareMarkdown(input)).toBe(expected)
    })

    it('preserves table rows', () => {
      const input = '| Col A | Col B |\n|---|---|\n| 1 | 2 |'
      expect(prepareMarkdown(input)).toBe(input)
    })

    it('preserves markdown formatting', () => {
      const input = '# Heading\n\n- item 1\n- item 2\n\n**bold** and *italic*'
      expect(prepareMarkdown(input)).toBe(input)
    })
  })

  describe('false positive avoidance', () => {
    it('does not fence single braces in prose', () => {
      const input = 'Use the {x} syntax for templates.'
      expect(prepareMarkdown(input)).toBe(input)
    })

    it('does not fence braces in inline code', () => {
      const input = 'Run `obj = {key: val}` to create it.'
      expect(prepareMarkdown(input)).toBe(input)
    })

    it('does not fence line ending with { if next lines are not JSON-like', () => {
      const input = 'This function returns {\nsome random text\n}'
      // Next line is just text, not JSON-like, so should not fence
      expect(prepareMarkdown(input)).toBe(input)
    })
  })
})
