import { describe, expect, it } from 'vitest'
import { decodeHtml, encodeHtml, inspect } from './unicode'

describe('inspect', () => {
  it('handles BMP characters', () => {
    const [info] = inspect('A')
    expect(info.codePoint).toBe(65)
    expect(info.hex).toBe('41')
    expect(info.unicode).toBe('U+0041')
    expect(info.js).toBe('\\u0041')
    expect(info.html).toBe('&#65;')
  })

  it('handles astral characters as one entry', () => {
    const infos = inspect('😀')
    expect(infos).toHaveLength(1)
    expect(infos[0].codePoint).toBe(0x1f600)
    expect(infos[0].js).toBe('\\u{1F600}')
  })

  it('tracks UTF-16 indices across surrogate pairs', () => {
    const infos = inspect('a😀b')
    expect(infos.map((i) => i.index)).toEqual([0, 1, 3])
    expect(infos[2].char).toBe('b')
  })
})

describe('encodeHtml', () => {
  it('escapes the named entities', () => {
    expect(encodeHtml('<a & "b">')).toBe('&lt;a &amp; &quot;b&quot;&gt;')
  })

  it('encodes non-ASCII numerically', () => {
    expect(encodeHtml('é')).toBe('&#233;')
  })
})

describe('decodeHtml', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeHtml('&lt;a&gt; &amp; &#233; &#x1F600;')).toBe('<a> & é 😀')
  })

  it('round-trips through encode', () => {
    const source = '<héllo> & "world"'
    expect(decodeHtml(encodeHtml(source))).toBe(source)
  })
})
