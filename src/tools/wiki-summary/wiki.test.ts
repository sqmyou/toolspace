import { describe, expect, it } from 'vitest'
import { normalizeTitle, parseSummary, summaryUrl } from './wiki'

describe('normalizeTitle', () => {
  it('accepts a bare title', () => {
    expect(normalizeTitle('JavaScript')).toBe('JavaScript')
    expect(normalizeTitle('  Alan Turing  ')).toBe('Alan Turing')
  })

  it('turns underscores into spaces, as Wikipedia urls do', () => {
    expect(normalizeTitle('Alan_Turing')).toBe('Alan Turing')
  })

  it('extracts the title from a wikipedia url', () => {
    expect(normalizeTitle('https://en.wikipedia.org/wiki/Alan_Turing')).toBe('Alan Turing')
    expect(normalizeTitle('https://de.wikipedia.org/wiki/JavaScript')).toBe('JavaScript')
  })

  it('strips a fragment or query from a url', () => {
    expect(normalizeTitle('https://en.wikipedia.org/wiki/Rust_(programming_language)#History')).toBe(
      'Rust (programming language)',
    )
    expect(normalizeTitle('https://en.wikipedia.org/wiki/Cat?action=raw')).toBe('Cat')
  })

  it('rejects empty input and non-wiki urls', () => {
    expect(normalizeTitle('')).toBeNull()
    expect(normalizeTitle('   ')).toBeNull()
    expect(normalizeTitle('https://example.com/wiki/Thing')).toBeNull()
  })
})

describe('summaryUrl', () => {
  it('encodes the title, spaces becoming underscores', () => {
    expect(summaryUrl('Alan Turing')).toBe('https://en.wikipedia.org/api/rest_v1/page/summary/Alan_Turing')
  })

  it('escapes characters that would break the path', () => {
    expect(summaryUrl('Rust (programming language)')).toBe('https://en.wikipedia.org/api/rest_v1/page/summary/Rust_(programming_language)')
  })
})

describe('parseSummary', () => {
  it('reads the fields the ui needs', () => {
    const summary = parseSummary({
      title: 'JavaScript',
      description: 'Programming language',
      extract: 'JavaScript is a programming language.',
      type: 'standard',
      lang: 'en',
      thumbnail: { source: 'https://upload.wikimedia.org/x.png', width: 200, height: 150 },
      content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/JavaScript' } },
    })
    expect(summary.title).toBe('JavaScript')
    expect(summary.description).toBe('Programming language')
    expect(summary.thumbnail).toEqual({ src: 'https://upload.wikimedia.org/x.png', width: 200, height: 150 })
    expect(summary.url).toBe('https://en.wikipedia.org/wiki/JavaScript')
    expect(summary.disambiguation).toBe(false)
  })

  it('flags disambiguation pages', () => {
    expect(parseSummary({ type: 'disambiguation' }).disambiguation).toBe(true)
  })

  it('survives a malformed payload', () => {
    const summary = parseSummary(null)
    expect(summary.title).toBe('')
    expect(summary.extract).toBe('')
    expect(summary.thumbnail).toBeUndefined()
  })
})
