import { describe, expect, it } from 'vitest'
import { compareVersions, describeRange, isStable, nextVersions, parse, satisfies, SemverError } from './semver'

describe('parse', () => {
  it('parses a full version', () => {
    expect(parse('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [], build: [] })
  })

  it('parses prerelease and build metadata', () => {
    expect(parse('1.0.0-alpha.1+build.5')).toEqual({
      major: 1, minor: 0, patch: 0, prerelease: ['alpha', '1'], build: ['build', '5'],
    })
  })

  it('accepts a leading v', () => {
    expect(parse('v2.0.1').major).toBe(2)
  })

  it('rejects malformed versions', () => {
    expect(() => parse('1.2')).toThrow(SemverError)
    expect(() => parse('nope')).toThrow(SemverError)
  })
})

describe('compare', () => {
  it('orders by major, minor then patch', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1)
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1)
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1)
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
  })

  it('orders prereleases below releases', () => {
    expect(compareVersions('1.0.0-alpha', '1.0.0')).toBe(-1)
    expect(compareVersions('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1)
    expect(compareVersions('1.0.0-alpha.1', '1.0.0-beta')).toBe(-1)
    expect(compareVersions('1.0.0-rc.2', '1.0.0-rc.10')).toBe(-1)
  })
})

describe('isStable', () => {
  it('treats prereleases as unstable', () => {
    expect(isStable(parse('1.0.0'))).toBe(true)
    expect(isStable(parse('1.0.0-beta'))).toBe(false)
  })
})

describe('nextVersions', () => {
  it('suggests the three bumps', () => {
    expect(nextVersions(parse('1.2.3')).map((b) => b.version)).toEqual(['1.2.4', '1.3.0', '2.0.0'])
  })
})

describe('satisfies', () => {
  it('matches exact versions', () => {
    expect(satisfies('1.2.3', '1.2.3')).toBe(true)
    expect(satisfies('1.2.4', '1.2.3')).toBe(false)
  })

  it('handles comparators', () => {
    expect(satisfies('1.5.0', '>=1.2.0')).toBe(true)
    expect(satisfies('1.1.0', '>=1.2.0')).toBe(false)
    expect(satisfies('1.5.0', '>=1.2.0 <2.0.0')).toBe(true)
    expect(satisfies('2.0.0', '>=1.2.0 <2.0.0')).toBe(false)
  })

  it('handles caret ranges', () => {
    expect(satisfies('1.9.0', '^1.2.3')).toBe(true)
    expect(satisfies('2.0.0', '^1.2.3')).toBe(false)
    expect(satisfies('0.2.5', '^0.2.3')).toBe(true)
    expect(satisfies('0.3.0', '^0.2.3')).toBe(false)
  })

  it('handles tilde ranges', () => {
    expect(satisfies('1.2.9', '~1.2.3')).toBe(true)
    expect(satisfies('1.3.0', '~1.2.3')).toBe(false)
  })

  it('handles wildcards', () => {
    expect(satisfies('1.9.0', '1.x')).toBe(true)
    expect(satisfies('2.0.0', '1.x')).toBe(false)
    expect(satisfies('1.2.9', '1.2.x')).toBe(true)
    expect(satisfies('9.9.9', '*')).toBe(true)
  })

  it('handles hyphen ranges', () => {
    expect(satisfies('1.5.0', '1.2.3 - 2.0.0')).toBe(true)
    expect(satisfies('2.0.1', '1.2.3 - 2.0.0')).toBe(false)
  })

  it('handles unions', () => {
    expect(satisfies('3.0.0', '^1.0.0 || ^3.0.0')).toBe(true)
    expect(satisfies('2.0.0', '^1.0.0 || ^3.0.0')).toBe(false)
  })
})

describe('describeRange', () => {
  it('explains each range shape', () => {
    expect(describeRange('*')).toMatch(/Any/)
    expect(describeRange('^1.2.3')).toMatch(/Compatible/)
    expect(describeRange('~1.2.3')).toMatch(/Approximately/)
    expect(describeRange('1.2.3 - 2.0.0')).toMatch(/Between/)
    expect(describeRange('1.x')).toMatch(/wildcard/)
  })
})
