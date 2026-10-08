/**
 * Semantic Versioning parsing, comparison and range matching.
 *
 * Implements enough of node-semver to be useful — `^`, `~`, comparators,
 * wildcards, hyphen ranges and `||` unions — without pulling in a dependency.
 */

export interface SemVer {
  major: number
  minor: number
  patch: number
  prerelease: string[]
  build: string[]
}

export class SemverError extends Error {}

const PATTERN =
  /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/

export function parse(version: string): SemVer {
  const match = PATTERN.exec(version.trim())
  if (!match) throw new SemverError(`"${version}" is not a valid semantic version.`)
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
    build: match[5] ? match[5].split('.') : [],
  }
}

function comparePrerelease(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1
  if (b.length === 0) return -1
  const length = Math.max(a.length, b.length)
  for (let i = 0; i < length; i++) {
    const x = a[i]
    const y = b[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const xn = /^\d+$/.test(x)
    const yn = /^\d+$/.test(y)
    if (xn && yn) {
      const diff = Number(x) - Number(y)
      if (diff !== 0) return diff < 0 ? -1 : 1
    } else if (xn) {
      return -1
    } else if (yn) {
      return 1
    } else if (x !== y) {
      return x < y ? -1 : 1
    }
  }
  return 0
}

export function compare(a: SemVer, b: SemVer): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1
  return comparePrerelease(a.prerelease, b.prerelease)
}

export function compareVersions(a: string, b: string): number {
  return compare(parse(a), parse(b))
}

export function isStable(version: SemVer): boolean {
  return version.prerelease.length === 0
}

export interface Bump {
  label: string
  version: string
}

export function nextVersions(version: SemVer): Bump[] {
  const { major, minor, patch } = version
  return [
    { label: 'Patch', version: `${major}.${minor}.${patch + 1}` },
    { label: 'Minor', version: `${major}.${minor + 1}.0` },
    { label: 'Major', version: `${major + 1}.0.0` },
  ]
}

interface Comparator {
  operator: '>' | '>=' | '<' | '<=' | '='
  version: SemVer
}

function comparatorMatches(comparator: Comparator, version: SemVer): boolean {
  const diff = compare(version, comparator.version)
  switch (comparator.operator) {
    case '>':
      return diff > 0
    case '>=':
      return diff >= 0
    case '<':
      return diff < 0
    case '<=':
      return diff <= 0
    default:
      return diff === 0
  }
}

const ANY: Comparator = { operator: '>=', version: { major: 0, minor: 0, patch: 0, prerelease: [], build: [] } }

/** Expand one whitespace-separated comparator set into range comparators. */
function expand(token: string): Comparator[] {
  const text = token.trim()
  if (text === '' || text === '*' || text.toLowerCase() === 'x') return [ANY]

  // Hyphen range: "1.2.3 - 2.0.0".
  const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(text)
  if (hyphen) {
    return [
      { operator: '>=', version: parseLoose(hyphen[1]) },
      { operator: '<=', version: parseLoose(hyphen[2]) },
    ]
  }

  const caret = /^\^(.+)$/.exec(text)
  if (caret) {
    const base = parseLoose(caret[1])
    const upper = base.major > 0
      ? `${base.major + 1}.0.0`
      : base.minor > 0
        ? `0.${base.minor + 1}.0`
        : `0.0.${base.patch + 1}`
    return [
      { operator: '>=', version: base },
      { operator: '<', version: parse(upper) },
    ]
  }

  const tilde = /^~(.+)$/.exec(text)
  if (tilde) {
    const base = parseLoose(tilde[1])
    return [
      { operator: '>=', version: base },
      { operator: '<', version: parse(`${base.major}.${base.minor + 1}.0`) },
    ]
  }

  const op = /^(>=|<=|>|<|=)?\s*(.+)$/.exec(text)
  if (!op) throw new SemverError(`Cannot parse range "${text}".`)
  const base = parseLoose(op[2])
  const wildcard = /[xX*]/.test(op[2])
  if (wildcard && (op[1] === undefined || op[1] === '=')) {
    // A wildcard means "any version in this prefix".
    const parts = op[2].split('.')
    if (parts[0] === 'x' || parts[0] === 'X' || parts[0] === '*') return [ANY]
    if (parts[1] === 'x' || parts[1] === 'X' || parts[1] === '*') {
      return [
        { operator: '>=', version: parse(`${base.major}.0.0`) },
        { operator: '<', version: parse(`${base.major + 1}.0.0`) },
      ]
    }
    return [
      { operator: '>=', version: parse(`${base.major}.${base.minor}.0`) },
      { operator: '<', version: parse(`${base.major}.${base.minor + 1}.0`) },
    ]
  }
  return [{ operator: (op[1] as Comparator['operator']) ?? '=', version: base }]
}

/** Like parse, but fills missing minor/patch with zero and wildcards with 0. */
function parseLoose(version: string): SemVer {
  const trimmed = version.trim().replace(/^v/, '')
  if (PATTERN.test(trimmed)) return parse(trimmed)
  const parts = trimmed.split('.')
  const filled = [parts[0] ?? '0', parts[1] ?? '0', parts[2] ?? '0']
    .map((part) => (/^[xX*]$/.test(part) ? '0' : part))
    .join('.')
  return parse(filled)
}

export function satisfies(version: string, range: string): boolean {
  const target = parse(version)
  const groups = range.split('||')
  for (const group of groups) {
    // A hyphen range spans whitespace, so it must be detected before the
    // whitespace split would break it into separate tokens.
    const hyphen = /^\s*(\S+)\s+-\s+(\S+)\s*$/.exec(group)
    const comparators: Comparator[] = hyphen
      ? [{ operator: '>=', version: parseLoose(hyphen[1]) }, { operator: '<=', version: parseLoose(hyphen[2]) }]
      : (() => {
          const sets = group.trim().split(/\s+/).filter(Boolean)
          const list: Comparator[] = []
          for (const token of sets) list.push(...expand(token))
          return list
        })()
    if (comparators.every((comparator) => comparatorMatches(comparator, target))) return true
  }
  return false
}

/** Explain a range in plain words, for the UI. */
export function describeRange(range: string): string {
  const trimmed = range.trim()
  if (!trimmed || trimmed === '*' || trimmed.toLowerCase() === 'x') return 'Any version.'
  if (trimmed.startsWith('^')) return 'Compatible with the given version (no breaking changes).'
  if (trimmed.startsWith('~')) return 'Approximately the given version (patch-level changes only).'
  if (trimmed.includes('||')) return 'Matches any of the alternatives.'
  if (/\s-\s/.test(trimmed)) return 'Between two versions, inclusive.'
  if (/[xX*]/.test(trimmed)) return 'Any version matching the wildcard.'
  return 'Exact or comparator match.'
}
