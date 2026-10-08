import { describe, expect, it } from 'vitest'
import { explain, generate, GitignoreError, isIgnored, parseLines, parsePattern, summarise, TEMPLATES, templateNames } from './gitignore'

describe('parsePattern', () => {
  it('ignores blanks and comments', () => {
    expect(parsePattern('')).toBeNull()
    expect(parsePattern('   ')).toBeNull()
    expect(parsePattern('# a comment')).toBeNull()
  })

  it('reads the markers', () => {
    const info = parsePattern('!/build/')
    expect(info).toMatchObject({ negated: true, directoryOnly: true, anchored: true, body: 'build' })
  })

  it('anchors a pattern that contains a slash', () => {
    expect(parsePattern('src/generated')?.anchored).toBe(true)
    expect(parsePattern('*.log')?.anchored).toBe(false)
  })
})

describe('isIgnored', () => {
  const patterns = ['node_modules/', '*.log', '/build/', 'src/generated', '!keep.log']

  it('matches a directory pattern at any depth', () => {
    expect(isIgnored(patterns, 'node_modules')).toBe(true)
    expect(isIgnored(patterns, 'packages/app/node_modules')).toBe(true)
    expect(isIgnored(patterns, 'node_modules/react/index.js')).toBe(true)
  })

  it('matches a bare glob at any depth', () => {
    expect(isIgnored(patterns, 'debug.log')).toBe(true)
    expect(isIgnored(patterns, 'logs/deep/debug.log')).toBe(true)
  })

  it('anchors a leading slash to the root', () => {
    expect(isIgnored(patterns, 'build')).toBe(true)
    expect(isIgnored(patterns, 'nested/build')).toBe(false)
  })

  it('anchors a pattern containing a slash', () => {
    expect(isIgnored(patterns, 'src/generated')).toBe(true)
    expect(isIgnored(patterns, 'src/generated/out.js')).toBe(true)
    expect(isIgnored(patterns, 'other/src/generated')).toBe(false)
  })

  it('lets a later negation win', () => {
    expect(isIgnored(patterns, 'keep.log')).toBe(false)
    expect(isIgnored(patterns, 'other.log')).toBe(true)
  })

  it('handles double star', () => {
    expect(isIgnored(['**/temp'], 'a/b/temp')).toBe(true)
    expect(isIgnored(['temp/**'], 'temp/a/b')).toBe(true)
    expect(isIgnored(['a/**/b'], 'a/x/y/b')).toBe(true)
  })

  it('handles character classes and question marks', () => {
    expect(isIgnored(['file?.txt'], 'file1.txt')).toBe(true)
    expect(isIgnored(['file?.txt'], 'file12.txt')).toBe(false)
    expect(isIgnored(['[abc].txt'], 'b.txt')).toBe(true)
    expect(isIgnored(['[abc].txt'], 'd.txt')).toBe(false)
  })

  it('does not let a star cross a directory', () => {
    expect(isIgnored(['*.log'], 'a/b.log')).toBe(true)
    expect(isIgnored(['a*.log'], 'a/b.log')).toBe(false)
  })

  it('normalises a leading dot slash', () => {
    expect(isIgnored(['*.log'], './debug.log')).toBe(true)
  })

  it('ignores nothing when there are no patterns', () => {
    expect(isIgnored([], 'anything')).toBe(false)
  })
})

describe('explain', () => {
  it('reports which pattern decided the outcome', () => {
    const result = explain(['*.log', '!keep.log'], 'keep.log')
    expect(result).toMatchObject({ ignored: false, matched: '!keep.log', negated: true })
  })

  it('reports the last matching pattern', () => {
    const result = explain(['*.log', 'debug.log'], 'debug.log')
    expect(result.matched).toBe('debug.log')
    expect(result.ignored).toBe(true)
  })

  it('reports no match', () => {
    expect(explain(['*.log'], 'readme.md').matched).toBeNull()
  })
})

describe('parseLines', () => {
  it('keeps only real patterns', () => {
    const infos = parseLines('# header\n\n*.log\n!keep.log\n')
    expect(infos.map((info) => info.pattern)).toEqual(['*.log', '!keep.log'])
  })
})

describe('templates', () => {
  it('lists and generates templates', () => {
    const names = templateNames()
    expect(names).toContain('Node')
    const text = generate(['Node', 'macOS'])
    expect(text).toContain('# Node')
    expect(text).toContain('node_modules/')
    expect(text).toContain('# macOS')
  })

  it('produces an empty string for no templates', () => {
    expect(generate([])).toBe('')
  })

  it('rejects an unknown template', () => {
    expect(() => generate(['Nope'])).toThrow(GitignoreError)
  })

  it('keeps every template free of blank leading lines', () => {
    for (const body of Object.values(TEMPLATES)) {
      expect(body.split('\n')[0].length).toBeGreaterThan(0)
    }
  })
})

describe('summarise', () => {
  it('counts the kinds of pattern', () => {
    const result = summarise(['*.log', '!keep.log', 'node_modules/', '/build'])
    expect(result).toMatchObject({ total: 4, negations: 1, directoryOnly: 1, anchored: 1 })
  })
})
