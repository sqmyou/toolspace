import { describe, expect, it } from 'vitest'
import { changelogSection, formatCommit, lintCommit, parseCommit } from './commit'

describe('parseCommit', () => {
  it('parses type, scope, bang and description', () => {
    expect(parseCommit('feat(api)!: drop v1')).toMatchObject({
      type: 'feat',
      scope: 'api',
      breaking: true,
      description: 'drop v1',
    })
  })

  it('parses body and footers', () => {
    const parts = parseCommit('fix: a\n\nThe body line.\n\nBREAKING CHANGE: it changed\nRefs: #12')
    expect(parts?.body).toBe('The body line.')
    expect(parts?.footers).toEqual([
      { token: 'BREAKING CHANGE', value: 'it changed' },
      { token: 'Refs', value: '#12' },
    ])
    expect(parts?.breaking).toBe(true)
  })

  it('returns null for a malformed header', () => {
    expect(parseCommit('just some text')).toBeNull()
  })
})

describe('lintCommit', () => {
  it('accepts a clean message', () => {
    const report = lintCommit('feat(tools): add har analyzer')
    expect(report.valid).toBe(true)
    expect(report.findings).toEqual([])
  })

  it('rejects an empty message', () => {
    expect(lintCommit('   ').valid).toBe(false)
  })

  it('rejects a header with no type', () => {
    const report = lintCommit('Some change without a type')
    expect(report.valid).toBe(false)
    expect(report.findings[0].message).toMatch(/type\(scope\)/)
  })

  it('rejects an unknown type', () => {
    const report = lintCommit('feature: add a thing')
    expect(report.valid).toBe(false)
    expect(report.findings.some((finding) => /not a known type/.test(finding.message))).toBe(true)
  })

  it('warns about a capitalised, past-tense, full-stop description', () => {
    const messages = lintCommit('fix: Added a thing.').findings.map((finding) => finding.message)
    expect(messages.some((message) => /lower case/.test(message))).toBe(true)
    expect(messages.some((message) => /imperative/.test(message))).toBe(true)
    expect(messages.some((message) => /full stop/.test(message))).toBe(true)
  })

  it('warns about a long header', () => {
    const report = lintCommit(`feat: ${'x'.repeat(80)}`)
    expect(report.findings.some((finding) => /72 or fewer/.test(finding.message))).toBe(true)
  })

  it('warns when the blank line before the body is missing', () => {
    const report = lintCommit('fix: a thing\nBody on the next line')
    expect(report.findings.some((finding) => /blank line/.test(finding.message))).toBe(true)
  })

  it('flags a breaking change that is not documented', () => {
    const report = lintCommit('feat!: drop v1 support')
    expect(report.findings.some((finding) => /BREAKING CHANGE/.test(finding.message))).toBe(true)
  })

  it('does not flag a breaking change that has a footer', () => {
    const report = lintCommit('feat!: drop v1 support\n\nBREAKING CHANGE: v1 is gone')
    expect(report.findings.some((finding) => /should carry/.test(finding.message))).toBe(false)
  })
})

describe('formatCommit', () => {
  it('reassembles a message', () => {
    const parts = parseCommit('fix(ui): tidy spacing')
    expect(formatCommit(parts!)).toBe('fix(ui): tidy spacing')
  })

  it('includes the bang and footer for a breaking change', () => {
    const message = 'feat!: drop v1\n\nBREAKING CHANGE: v1 removed'
    expect(formatCommit(parseCommit(message)!)).toBe(message)
  })
})

describe('changelogSection', () => {
  it('maps types to sections', () => {
    expect(changelogSection('feat')).toBe('Features')
    expect(changelogSection('fix')).toBe('Bug Fixes')
    expect(changelogSection('chore')).toBe('Other Changes')
  })
})
