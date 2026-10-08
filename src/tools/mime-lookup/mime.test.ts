import { describe, expect, it } from 'vitest'
import { extensionOf, lookupByFilename, lookupByType, searchMime } from './mime'

describe('extensionOf', () => {
  it('extracts and lowercases the extension', () => {
    expect(extensionOf('Photo.JPG')).toBe('jpg')
    expect(extensionOf('/path/to/file.tar.gz')).toBe('gz')
    expect(extensionOf('file?x=1')).toBe('')
  })

  it('returns empty for dotless or dotfiles', () => {
    expect(extensionOf('Makefile')).toBe('')
    expect(extensionOf('.gitignore')).toBe('')
  })
})

describe('lookupByFilename', () => {
  it('maps common extensions', () => {
    expect(lookupByFilename('app.js').mime).toBe('application/javascript')
    expect(lookupByFilename('style.css').known).toBe(true)
  })

  it('falls back to octet-stream for unknown extensions', () => {
    const result = lookupByFilename('archive.xyz')
    expect(result.known).toBe(false)
    expect(result.mime).toBe('application/octet-stream')
  })
})

describe('lookupByType', () => {
  it('returns extensions for a type', () => {
    expect(lookupByType('image/jpeg')).toContain('jpg')
  })

  it('returns empty for unknown types', () => {
    expect(lookupByType('application/nope')).toEqual([])
  })
})

describe('searchMime', () => {
  it('matches on type or extension', () => {
    expect(searchMime('woff2').some((e) => e.type === 'font/woff2')).toBe(true)
    expect(searchMime('video/').every((e) => e.type.startsWith('video/'))).toBe(true)
    expect(searchMime('').length).toBeGreaterThan(40)
  })
})
