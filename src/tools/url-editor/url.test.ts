import { describe, expect, it } from 'vitest'
import { buildUrl, decodeComponent, encodeComponent, parseUrl } from './url'

describe('component encoding', () => {
  it('round-trips reserved characters', () => {
    const text = 'a b&c=d?e/f'
    expect(decodeComponent(encodeComponent(text))).toBe(text)
  })

  it('encodes spaces as %20', () => {
    expect(encodeComponent('a b')).toBe('a%20b')
  })
})

describe('parseUrl', () => {
  it('splits base, params and hash', () => {
    const parsed = parseUrl('https://a.dev/p?x=1&y=2#frag')
    expect(parsed.base).toBe('https://a.dev/p')
    expect(parsed.params).toEqual([
      { key: 'x', value: '1' },
      { key: 'y', value: '2' },
    ])
    expect(parsed.hash).toBe('frag')
  })

  it('decodes values and treats + as space', () => {
    const parsed = parseUrl('/search?q=hello+world&q=a%26b')
    expect(parsed.params).toEqual([
      { key: 'q', value: 'hello world' },
      { key: 'q', value: 'a&b' },
    ])
  })

  it('supports valueless keys and drops blanks', () => {
    const parsed = parseUrl('/p?flag&&=oops&ok=1')
    expect(parsed.params).toEqual([
      { key: 'flag', value: '' },
      { key: 'ok', value: '1' },
    ])
  })

  it('handles a URL with no query', () => {
    expect(parseUrl('/plain')).toEqual({ base: '/plain', params: [], hash: '' })
  })
})

describe('buildUrl', () => {
  it('encodes params when asked', () => {
    const url = buildUrl('/p', [{ key: 'q', value: 'a b&c' }], '', { encode: true, sort: false })
    expect(url).toBe('/p?q=a%20b%26c')
  })

  it('sorts keys when asked', () => {
    const url = buildUrl('/p', [{ key: 'b', value: '2' }, { key: 'a', value: '1' }], '', { encode: false, sort: true })
    expect(url).toBe('/p?a=1&b=2')
  })

  it('renders valueless params and reattaches the hash', () => {
    const url = buildUrl('/p', [{ key: 'flag', value: '' }], 'top', { encode: true, sort: false })
    expect(url).toBe('/p?flag#top')
  })

  it('round-trips a parsed URL', () => {
    const source = 'https://a.dev/p?x=1&y=hello%20world#z'
    const parsed = parseUrl(source)
    expect(buildUrl(parsed.base, parsed.params, parsed.hash, { encode: true, sort: false })).toBe(source)
  })
})
