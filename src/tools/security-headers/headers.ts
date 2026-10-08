/**
 * Response header review.
 *
 * The tool takes header lines pasted from `curl -I` or a proxy and reports
 * which security headers are set, which are weak, and which are missing. The
 * advice is deliberately conservative: a header counts as good only when its
 * value matches a known-strong form, because a present but permissive value is
 * worse than an obvious absence.
 */

export class HeaderError extends Error {}

export interface HeaderInfo {
  name: string
  /** Headers that should be absent rather than configured. */
  leak?: boolean
  weight: number
  advice: string
  /** Return a problem description when the value is weak, otherwise null. */
  check?: (value: string) => string | null
}

const HSTS_MIN_SECONDS = 15552000

function maxAge(value: string): number | null {
  const match = /max-age\s*=\s*(\d+)/i.exec(value)
  return match ? Number(match[1]) : null
}

export const HEADERS: HeaderInfo[] = [
  {
    name: 'strict-transport-security',
    weight: 3,
    advice: 'Forces HTTPS for future visits. Use a max-age of at least 15552000 seconds and add includeSubDomains.',
    check(value) {
      const age = maxAge(value)
      if (age === null) return 'There is no max-age value.'
      if (age < HSTS_MIN_SECONDS) return `max-age is only ${age} seconds; use at least ${HSTS_MIN_SECONDS}.`
      if (!/includeSubDomains/i.test(value)) return 'max-age is fine but includeSubDomains is missing.'
      return null
    },
  },
  {
    name: 'content-security-policy',
    weight: 4,
    advice: 'Restricts where scripts and other resources may load from. Start from default-src and avoid inline scripts.',
    check(value) {
      if (/'unsafe-inline'/i.test(value)) return "'unsafe-inline' weakens the policy to allow inline scripts."
      if (/'unsafe-eval'/i.test(value)) return "'unsafe-eval' allows eval and similar dynamic code."
      if (!/default-src/i.test(value)) return 'There is no default-src directive to fall back on.'
      return null
    },
  },
  {
    name: 'x-content-type-options',
    weight: 2,
    advice: 'Stops the browser guessing a content type, which blocks a class of script injection.',
    check: (value) => (value.trim().toLowerCase() === 'nosniff' ? null : 'The value should be exactly nosniff.'),
  },
  {
    name: 'x-frame-options',
    weight: 2,
    advice: 'Prevents the page being framed elsewhere. DENY or SAMEORIGIN is expected.',
    check(value) {
      const normalised = value.trim().toUpperCase()
      if (normalised === 'DENY' || normalised === 'SAMEORIGIN') return null
      return 'Use DENY or SAMEORIGIN, or replace it with a CSP frame-ancestors directive.'
    },
  },
  {
    name: 'referrer-policy',
    weight: 2,
    advice: 'Controls how much URL information travels with outbound requests.',
    check(value) {
      const normalised = value.trim().toLowerCase()
      if (normalised === 'unsafe-url' || normalised === 'no-referrer-when-downgrade') return `${value} leaks the full URL to other origins.`
      const allowed = ['no-referrer', 'same-origin', 'origin', 'strict-origin', 'origin-when-cross-origin', 'strict-origin-when-cross-origin']
      if (allowed.includes(normalised)) return null
      return `${value} is not a recognised policy.`
    },
  },
  {
    name: 'permissions-policy',
    weight: 1,
    advice: 'Turns off browser features such as camera and geolocation that the page does not need.',
  },
  {
    name: 'cross-origin-opener-policy',
    weight: 2,
    advice: 'Isolates the browsing context from cross-origin windows.',
    check(value) {
      const normalised = value.trim().toLowerCase()
      if (normalised === 'same-origin' || normalised === 'same-origin-allow-popups') return null
      return 'Use same-origin, or same-origin-allow-popups if popups are needed.'
    },
  },
  {
    name: 'cross-origin-embedder-policy',
    weight: 1,
    advice: 'Required for powerful features such as SharedArrayBuffer.',
    check: (value) => (value.trim().toLowerCase() === 'require-corp' ? null : 'Use require-corp.'),
  },
  {
    name: 'cross-origin-resource-policy',
    weight: 1,
    advice: 'Stops other sites embedding this resource.',
    check(value) {
      const normalised = value.trim().toLowerCase()
      return ['same-origin', 'same-site'].includes(normalised) ? null : 'Use same-origin, or same-site if subdomains need it.'
    },
  },
  {
    name: 'x-xss-protection',
    weight: 1,
    advice: 'A legacy header. Set it to 0 so the old, buggy auditor stays off.',
    check: (value) => (value.trim() === '0' ? null : 'This header is obsolete; set it to 0.'),
  },
  {
    name: 'server',
    leak: true,
    weight: 1,
    advice: 'Reveals the server software and version. Remove or genericise it.',
  },
  {
    name: 'x-powered-by',
    leak: true,
    weight: 1,
    advice: 'Reveals the framework in use. Remove it.',
  },
]

export interface Finding {
  name: string
  present: boolean
  value: string | null
  status: 'good' | 'weak' | 'missing' | 'leaking'
  message: string
}

export interface Report {
  findings: Finding[]
  /** Percentage of the security weight that is satisfied. */
  score: number
  missing: string[]
  weak: string[]
  leaks: string[]
}

/** Read "Name: value" lines, ignoring a leading status line and comments. */
export function parseHeaders(input: string): Map<string, string> {
  const headers = new Map<string, string>()
  for (const raw of input.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || /^HTTP\/\d/i.test(line)) continue
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const name = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()
    if (!name) continue
    headers.set(name, headers.has(name) ? `${headers.get(name)}, ${value}` : value)
  }
  if (headers.size === 0) throw new HeaderError('No header lines were found. Paste lines such as "Content-Type: text/html".')
  return headers
}

export function analyse(input: string): Report {
  const headers = parseHeaders(input)
  const findings: Finding[] = []

  for (const info of HEADERS) {
    const value = headers.get(info.name) ?? null
    if (info.leak) {
      findings.push({
        name: info.name,
        present: value !== null,
        value,
        status: value === null ? 'good' : 'leaking',
        message: value === null ? 'Not advertised.' : `Present: ${value}`,
      })
      continue
    }
    if (value === null) {
      findings.push({ name: info.name, present: false, value: null, status: 'missing', message: info.advice })
      continue
    }
    const problem = info.check?.(value) ?? null
    findings.push({ name: info.name, present: true, value, status: problem ? 'weak' : 'good', message: problem ?? 'Set to a strong value.' })
  }

  const security = findings.filter((finding) => HEADERS.find((info) => info.name === finding.name)?.leak !== true)
  const total = security.reduce((sum, finding) => sum + (HEADERS.find((info) => info.name === finding.name)?.weight ?? 0), 0)
  const earned = security.reduce((sum, finding) => (finding.status === 'good' ? sum + (HEADERS.find((info) => info.name === finding.name)?.weight ?? 0) : sum), 0)

  return {
    findings,
    score: total === 0 ? 0 : Math.round((earned / total) * 100),
    missing: findings.filter((finding) => finding.status === 'missing').map((finding) => finding.name),
    weak: findings.filter((finding) => finding.status === 'weak').map((finding) => finding.name),
    leaks: findings.filter((finding) => finding.status === 'leaking').map((finding) => finding.name),
  }
}
