import { describe, expect, it } from 'vitest'
import { audit, emptyPolicy, removeDirective, serialize, setDirective, usedSources, withDefaults } from './csp'

const base = () =>
  setDirective(setDirective(emptyPolicy(), 'default-src', ["'self'"]), 'script-src', ["'self'"])

describe('setDirective / removeDirective', () => {
  it('adds and removes without mutating the original', () => {
    const start = emptyPolicy()
    const withOne = setDirective(start, 'img-src', ["'self'"])
    expect(start.directives['img-src']).toBeUndefined()
    const removed = removeDirective(withOne, 'img-src')
    expect(removed.directives['img-src']).toBeUndefined()
    expect(withOne.directives['img-src']).toEqual(["'self'"])
  })
})

describe('serialize', () => {
  it('puts default-src first and sorts the rest', () => {
    const policy = setDirective(setDirective(base(), 'img-src', ["'self'", 'data:']), 'style-src', ["'self'"])
    expect(serialize(policy)).toBe("default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'")
  })

  it('renders valueless directives without a trailing space', () => {
    const policy = setDirective(base(), 'upgrade-insecure-requests', [])
    expect(serialize(policy)).toContain('upgrade-insecure-requests')
    expect(serialize(policy)).not.toMatch(/upgrade-insecure-requests /)
  })

  it('prepends a header name when asked', () => {
    expect(serialize(base(), 'Content-Security-Policy')).toMatch(/^Content-Security-Policy: default-src/)
  })
})

describe('withDefaults', () => {
  it('produces a serialisable policy', () => {
    const text = serialize(withDefaults())
    expect(text).toContain("default-src 'self'")
    expect(text).toContain("object-src 'none'")
  })
})

describe('audit', () => {
  it('warns about unsafe-inline', () => {
    const policy = setDirective(base(), 'script-src', ["'self'", "'unsafe-inline'"])
    expect(audit(policy).some((f) => f.severity === 'warning' && f.message.includes('unsafe-inline'))).toBe(true)
  })

  it('errors on a wildcard script-src', () => {
    const policy = setDirective(base(), 'script-src', ['*'])
    expect(audit(policy).some((f) => f.severity === 'error')).toBe(true)
  })

  it('flags a missing base-uri', () => {
    expect(audit(base()).some((f) => f.message.includes('base-uri'))).toBe(true)
  })

  it('reports a clean policy as such', () => {
    const policy = setDirective(setDirective(setDirective(base(), 'base-uri', ["'self'"]), 'frame-ancestors', ["'none'"]), 'object-src', ["'none'"])
    expect(audit(policy)).toEqual([{ severity: 'info', message: 'No obvious weaknesses found in this policy.' }])
  })
})

describe('usedSources', () => {
  it('collects distinct tokens', () => {
    const policy = setDirective(setDirective(base(), 'img-src', ["'self'", 'data:']), 'font-src', ['https://fonts.gstatic.com'])
    expect(usedSources(policy)).toEqual(["'self'", 'data:', 'https://fonts.gstatic.com'])
  })
})
