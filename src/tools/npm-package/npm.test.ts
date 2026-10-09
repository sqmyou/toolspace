import { describe, expect, it } from 'vitest'
import {
  downloadsUrl,
  formatBytes,
  formatCount,
  manifestUrl,
  normalizePackage,
  parseDownloads,
  parseManifest,
} from './npm'

describe('normalizePackage', () => {
  it('accepts a bare name', () => {
    expect(normalizePackage('react')).toBe('react')
    expect(normalizePackage('  react  ')).toBe('react')
    expect(normalizePackage('react-dom')).toBe('react-dom')
  })

  it('accepts a scoped name', () => {
    expect(normalizePackage('@types/node')).toBe('@types/node')
    expect(normalizePackage('@angular/core')).toBe('@angular/core')
  })

  it('strips a version or tag', () => {
    expect(normalizePackage('react@19.0.0')).toBe('react')
    expect(normalizePackage('react@latest')).toBe('react')
    expect(normalizePackage('@types/node@20')).toBe('@types/node')
  })

  it('extracts the name from an npmjs.com url', () => {
    expect(normalizePackage('https://www.npmjs.com/package/react')).toBe('react')
    expect(normalizePackage('https://www.npmjs.com/package/@types/node')).toBe('@types/node')
  })

  it('rejects empty, uppercase and malformed names', () => {
    expect(normalizePackage('')).toBeNull()
    expect(normalizePackage('   ')).toBeNull()
    expect(normalizePackage('React')).toBeNull()
    expect(normalizePackage('.hidden')).toBeNull()
    expect(normalizePackage('has spaces')).toBeNull()
  })
})

describe('url builders', () => {
  it('escapes the slash in a scoped name for the registry', () => {
    expect(manifestUrl('react')).toBe('https://registry.npmjs.org/react/latest')
    expect(manifestUrl('@types/node')).toBe('https://registry.npmjs.org/@types%2fnode/latest')
  })

  it('builds the downloads url', () => {
    expect(downloadsUrl('react')).toBe('https://api.npmjs.org/downloads/point/last-week/react')
    expect(downloadsUrl('@types/node', 'last-month')).toBe('https://api.npmjs.org/downloads/point/last-month/@types%2fnode')
  })
})

describe('parseManifest', () => {
  it('reads the fields the ui needs', () => {
    const facts = parseManifest({
      name: 'react',
      version: '19.0.0',
      description: 'A library',
      license: 'MIT',
      homepage: 'https://react.dev/',
      repository: { url: 'git+https://github.com/facebook/react.git' },
      dependencies: { a: '1', b: '2' },
      maintainers: [{ name: 'x' }],
      dist: { unpackedSize: 178663 },
    })
    expect(facts).toMatchObject({
      name: 'react',
      version: '19.0.0',
      license: 'MIT',
      dependencies: 2,
      maintainers: 1,
      unpackedSize: 178663,
    })
    expect(facts?.repository).toContain('github.com/facebook/react')
  })

  it('returns null when there is no name', () => {
    expect(parseManifest({ version: '1' })).toBeNull()
    expect(parseManifest(null)).toBeNull()
  })
})

describe('parseDownloads', () => {
  it('reads the count', () => {
    expect(parseDownloads({ downloads: 186323857 })).toBe(186323857)
  })

  it('returns null for a malformed payload', () => {
    expect(parseDownloads(null)).toBeNull()
    expect(parseDownloads({ downloads: 'x' })).toBeNull()
  })
})

describe('formatBytes', () => {
  it('scales through the units', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(178663)).toBe('179 kB')
    expect(formatBytes(2_500_000)).toBe('2.5 MB')
  })

  it('renders a dash for zero or nonsense', () => {
    expect(formatBytes(0)).toBe('\u2014')
    expect(formatBytes(Number.NaN)).toBe('\u2014')
  })
})

describe('formatCount', () => {
  it('compacts large numbers', () => {
    expect(formatCount(999)).toBe('999')
    expect(formatCount(12_500)).toBe('12.5k')
    expect(formatCount(186_323_857)).toBe('186.3M')
    expect(formatCount(2_100_000_000)).toBe('2.1B')
  })
})
