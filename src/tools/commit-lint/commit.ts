/**
 * Conventional Commits linting.
 *
 * A commit message is `type(scope)!: description`, then an optional body and
 * footers, separated by blank lines. The spec is short; the checks here are the
 * ones reviewers actually care about (correct type, imperative subject, the
 * blank line before the body, a `BREAKING CHANGE:` footer when `!` is used).
 */

export const TYPES = [
  'feat', 'fix', 'docs', 'style', 'refactor', 'perf',
  'test', 'build', 'ci', 'chore', 'revert',
] as const

export type CommitType = (typeof TYPES)[number]

export interface CommitParts {
  type: string
  scope: string | null
  breaking: boolean
  description: string
  body: string
  footers: { token: string; value: string }[]
}

export type Severity = 'error' | 'warning'

export interface CommitFinding {
  severity: Severity
  message: string
}

export interface CommitReport {
  valid: boolean
  parts: CommitParts | null
  findings: CommitFinding[]
}

const HEADER_RE = /^([a-zA-Z]+)(?:\(([^()\r\n]+)\))?(!)?: (.*)$/

/** Parse a message into its parts. Returns null when the header is malformed. */
export function parseCommit(message: string): CommitParts | null {
  const normalised = message.replace(/\r\n?/g, '\n').replace(/\s+$/, '')
  const [header, ...rest] = normalised.split('\n')
  const match = HEADER_RE.exec(header.trim())
  if (!match) return null

  const [, type, scope, bang, description] = match
  const remaining = rest.join('\n').replace(/^\n+/, '')

  const footers: { token: string; value: string }[] = []
  const bodyLines: string[] = []
  let inFooters = false
  for (const line of remaining.split('\n')) {
    const footer = /^(?:([A-Za-z0-9-]+)|(BREAKING CHANGE|BREAKING-CHANGE)): (.*)$/.exec(line)
    if (footer) {
      inFooters = true
      footers.push({ token: (footer[2] ?? footer[1] ?? '').toUpperCase() === 'BREAKING-CHANGE' ? 'BREAKING CHANGE' : footer[2] ?? footer[1], value: footer[3] })
      continue
    }
    if (/^[A-Za-z0-9-]+ #/.test(line) && inFooters) continue
    if (inFooters) footers[footers.length - 1].value += `\n${line}`
    else bodyLines.push(line)
  }

  return {
    type: type.toLowerCase(),
    scope: scope ? scope.toLowerCase() : null,
    breaking: bang === '!' || footers.some((footer) => footer.token.toUpperCase() === 'BREAKING CHANGE'),
    description,
    body: bodyLines.join('\n').trim(),
    footers,
  }
}

const IMPERATIVE_PAST = /^(added|adds|fixed|fixes|updated|updates|changed|changes|removed|removes|created|creates|merged|merges|bumped|bumps|improved|improves|refactored|refactors)\b/i

/** Lint a commit message against the Conventional Commits spec. */
export function lintCommit(message: string): CommitReport {
  const findings: CommitFinding[] = []
  const trimmed = message.replace(/\r\n?/g, '\n').replace(/\s+$/, '')

  if (!trimmed.trim()) {
    return { valid: false, parts: null, findings: [{ severity: 'error', message: 'The message is empty.' }] }
  }

  const parts = parseCommit(trimmed)
  if (!parts) {
    return {
      valid: false,
      parts: null,
      findings: [
        {
          severity: 'error',
          message: 'The first line must be "type(scope): description". Example: "fix(parser): handle empty input".',
        },
      ],
    }
  }

  const header = trimmed.split('\n')[0]

  if (!(TYPES as readonly string[]).includes(parts.type)) {
    findings.push({ severity: 'error', message: `"${parts.type}" is not a known type. Use one of: ${TYPES.join(', ')}.` })
  }
  if (!parts.description) {
    findings.push({ severity: 'error', message: 'The description after the colon is empty.' })
  }
  if (header.length > 72) {
    findings.push({ severity: 'warning', message: `The header is ${header.length} characters. Keep it at 72 or fewer.` })
  }
  if (parts.description && parts.description.length > 0) {
    if (/^[A-Z]/.test(parts.description)) {
      findings.push({ severity: 'warning', message: 'The description usually starts lower case.' })
    }
    if (/\.$/.test(parts.description)) {
      findings.push({ severity: 'warning', message: 'The description should not end with a full stop.' })
    }
    if (IMPERATIVE_PAST.test(parts.description)) {
      findings.push({ severity: 'warning', message: 'Use the imperative mood: "add", not "added".' })
    }
  }
  if (parts.scope && !/^[a-z0-9][a-z0-9._/-]*$/.test(parts.scope)) {
    findings.push({ severity: 'warning', message: `Scope "${parts.scope}" should be lower-case (letters, digits, ._/-).` })
  }

  const lines = trimmed.split('\n')
  if (lines.length > 1 && lines[1].trim() !== '') {
    findings.push({ severity: 'warning', message: 'Leave a blank line between the header and the body.' })
  }

  const breakingFooter = parts.footers.some((footer) => footer.token.toUpperCase() === 'BREAKING CHANGE')
  if (parts.breaking && !breakingFooter) {
    findings.push({ severity: 'warning', message: 'A breaking change should carry a "BREAKING CHANGE:" footer explaining it.' })
  }
  if (breakingFooter) {
    findings.push({ severity: 'warning', message: 'Breaking change: this will require a major version bump.' })
  }

  return {
    valid: !findings.some((finding) => finding.severity === 'error'),
    parts,
    findings,
  }
}

/** A normalised, copy-ready version of a message. */
export function formatCommit(parts: CommitParts): string {
  const header = `${parts.type}${parts.scope ? `(${parts.scope})` : ''}${parts.breaking ? '!' : ''}: ${parts.description}`
  const chunks = [header]
  if (parts.body) chunks.push(parts.body)
  if (parts.footers.length) chunks.push(parts.footers.map((footer) => `${footer.token}: ${footer.value}`).join('\n'))
  return chunks.join('\n\n')
}

/** A changelog section name for a commit type. */
export function changelogSection(type: string): string {
  switch (type) {
    case 'feat':
      return 'Features'
    case 'fix':
      return 'Bug Fixes'
    case 'perf':
      return 'Performance'
    case 'revert':
      return 'Reverts'
    case 'docs':
      return 'Documentation'
    default:
      return 'Other Changes'
  }
}
