import { describe, expect, it } from 'vitest'
import { codePoints, decode, encode, namedEntities, stripTags } from './entities'

describe('encode', () => {
  it('escapes the characters that break HTML', () => {
    expect(encode('<a href="x">')).toBe('&lt;a href=&quot;x&quot;&gt;')
    expect(encode('Tom & Jerry')).toBe('Tom &amp; Jerry')
  })

  it('escapes apostrophes', () => {
    expect(encode("it's")).toBe('it&#39;s')
  })

  it('can leave quotes alone', () => {
    expect(encode(`<a href="x">`, { quotes: false })).toBe('&lt;a href="x"&gt;')
  })

  it('can escape every non-ASCII character', () => {
    expect(encode('café', { all: true })).toBe('caf&#233;')
    expect(encode('☕', { all: true })).toBe('&#9749;')
  })

  it('leaves plain text untouched', () => {
    expect(encode('Hello world')).toBe('Hello world')
  })

  it('escapes the ampersand only once', () => {
    expect(encode('&amp;')).toBe('&amp;amp;')
  })
})

describe('decode', () => {
  it('decodes named entities', () => {
    expect(decode('&lt;p&gt;')).toBe('<p>')
    expect(decode('Tom &amp; Jerry')).toBe('Tom & Jerry')
    expect(decode('&copy; 2024')).toBe('© 2024')
  })

  it('decodes decimal and hex references', () => {
    expect(decode('&#169;')).toBe('©')
    expect(decode('&#xA9;')).toBe('©')
    expect(decode('&#x1F600;')).toBe('😀')
  })

  it('leaves unknown entities alone', () => {
    expect(decode('&notreal;')).toBe('&notreal;')
    expect(decode('a & b')).toBe('a & b')
  })

  it('round-trips what encode produces', () => {
    for (const text of ['<p class="x">', 'Tom & Jerry', "it's", 'café ☕']) {
      expect(decode(encode(text))).toBe(text)
    }
  })

  it('ignores invalid code points', () => {
    expect(decode('&#xD800;')).toBe('&#xD800;')
    expect(decode('&#9999999999;')).toBe('&#9999999999;')
  })
})

describe('stripTags', () => {
  it('removes markup and decodes entities', () => {
    expect(stripTags('<p>Hello <b>world</b></p>')).toBe('Hello world')
    expect(stripTags('<a title="x">link</a>')).toBe('link')
  })

  it('collapses runs of spaces', () => {
    expect(stripTags('<p>a</p>   <p>b</p>')).toBe('a b')
  })

  it('decodes entities inside the text', () => {
    expect(stripTags('<p>Tom &amp; Jerry</p>')).toBe('Tom & Jerry')
  })
})

describe('namedEntities', () => {
  it('lists the characters that have a named entity', () => {
    const rows = namedEntities('© ® &')
    expect(rows.map((row) => row.name)).toEqual(['copy', 'reg', 'amp'])
    expect(rows[0].entity).toBe('&copy;')
  })

  it('does not repeat a character', () => {
    expect(namedEntities('&&').map((row) => row.name)).toEqual(['amp'])
  })

  it('ignores characters without a name', () => {
    expect(namedEntities('abc')).toEqual([])
  })
})

describe('codePoints', () => {
  it('lists every character with its code point', () => {
    const rows = codePoints('Aé')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ char: 'A', codePoint: 65 })
    expect(rows[1]).toMatchObject({ char: 'é', codePoint: 233, entity: '&#233;' })
  })

  it('handles astral characters as one entry', () => {
    const rows = codePoints('😀')
    expect(rows).toHaveLength(1)
    expect(rows[0].codePoint).toBe(128512)
  })
})
