/**
 * Parsing and auditing of HTTP cookies.
 *
 * `Set-Cookie` lines are parsed into their value plus attributes, then checked
 * for the flags browsers and auditors care about. A `Cookie` request header is
 * parsed separately because it carries names and values only.
 */

export interface CookieAttributes {
  domain?: string
  path?: string
  expires?: Date
  maxAge?: number
  secure: boolean
  httpOnly: boolean
  sameSite?: 'Strict' | 'Lax' | 'None' | 'unknown'
  partitioned: boolean
  /** Any other attribute, kept verbatim. */
  extra: [string, string][]
}

export interface ParsedCookie {
  name: string
  value: string
  attributes: CookieAttributes
  /** Whether the cookie is already expired, given the supplied clock. */
  expired: boolean
  issues: Issue[]
}

export interface Issue {
  level: 'error' | 'warn' | 'info'
  message: string
}

export class CookieError extends Error {}

function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function emptyAttributes(): CookieAttributes {
  return { secure: false, httpOnly: false, partitioned: false, extra: [] }
}

export function parseSetCookie(line: string, now: number = Date.now()): ParsedCookie {
  const text = line.trim()
  if (!text) throw new CookieError('Empty Set-Cookie line.')
  const segments = text.split(';')
  const first = segments.shift() ?? ''
  const eq = first.indexOf('=')
  if (eq < 0) throw new CookieError(`Expected name=value, got "${first.trim()}".`)
  const name = first.slice(0, eq).trim()
  if (!name) throw new CookieError('The cookie name is empty.')
  const value = first.slice(eq + 1).trim()

  const attributes = emptyAttributes()
  for (const raw of segments) {
    const segment = raw.trim()
    if (!segment) continue
    const index = segment.indexOf('=')
    const key = (index < 0 ? segment : segment.slice(0, index)).trim().toLowerCase()
    const attrValue = index < 0 ? '' : segment.slice(index + 1).trim()
    switch (key) {
      case 'domain':
        attributes.domain = attrValue
        break
      case 'path':
        attributes.path = attrValue
        break
      case 'expires': {
        const date = new Date(attrValue)
        if (!Number.isNaN(date.getTime())) attributes.expires = date
        break
      }
      case 'max-age': {
        const seconds = Number(attrValue)
        if (Number.isFinite(seconds)) attributes.maxAge = seconds
        break
      }
      case 'secure':
        attributes.secure = true
        break
      case 'httponly':
        attributes.httpOnly = true
        break
      case 'samesite': {
        const normalised = attrValue.charAt(0).toUpperCase() + attrValue.slice(1).toLowerCase()
        attributes.sameSite = normalised === 'Strict' || normalised === 'Lax' || normalised === 'None' ? normalised : 'unknown'
        break
      }
      case 'partitioned':
        attributes.partitioned = true
        break
      default:
        attributes.extra.push([key || segment, attrValue])
    }
  }

  const expired = isExpired(attributes, now)
  return { name, value, attributes, expired, issues: audit(name, attributes, expired) }
}

export function isExpired(attributes: CookieAttributes, now: number = Date.now()): boolean {
  if (attributes.maxAge !== undefined && attributes.maxAge <= 0) return true
  if (attributes.expires && attributes.expires.getTime() <= now) return true
  return false
}

function audit(name: string, attributes: CookieAttributes, expired: boolean): Issue[] {
  const issues: Issue[] = []
  const lowerName = name.toLowerCase()

  if (!attributes.secure) {
    issues.push({ level: 'warn', message: 'Missing the Secure flag — this cookie can travel over plain HTTP.' })
  }
  if (!attributes.httpOnly) {
    issues.push({ level: 'warn', message: 'Missing HttpOnly — JavaScript on the page can read this cookie.' })
  }
  if (attributes.sameSite === 'None' && !attributes.secure) {
    issues.push({ level: 'error', message: 'SameSite=None requires Secure, or browsers will reject the cookie.' })
  }
  if (!attributes.sameSite) {
    issues.push({ level: 'info', message: 'No SameSite attribute — modern browsers default to Lax.' })
  }
  if (lowerName.startsWith('__secure-') && !attributes.secure) {
    issues.push({ level: 'error', message: 'The __Secure- prefix requires the Secure flag.' })
  }
  if (lowerName.startsWith('__host-')) {
    if (!attributes.secure) issues.push({ level: 'error', message: 'The __Host- prefix requires the Secure flag.' })
    if (attributes.domain) issues.push({ level: 'error', message: 'The __Host- prefix forbids a Domain attribute.' })
    if (attributes.path !== '/') issues.push({ level: 'error', message: 'The __Host- prefix requires Path=/' })
  }
  if (expired) issues.push({ level: 'info', message: 'This cookie is expired and would be deleted by the browser.' })
  if (attributes.domain?.startsWith('.')) {
    issues.push({ level: 'info', message: 'A leading dot in Domain is ignored by modern browsers.' })
  }
  return issues
}

/** Parse a `Cookie:` request header into pairs. */
export function parseCookieHeader(header: string): { name: string; value: string }[] {
  return header
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf('=')
      if (eq < 0) return { name: part, value: '' }
      return { name: part.slice(0, eq).trim(), value: decode(part.slice(eq + 1).trim()) }
    })
    .filter((pair) => pair.name !== '')
}

/** Parse a full header block, one Set-Cookie per line. */
export function parseSetCookieBlock(block: string, now: number = Date.now()): ParsedCookie[] {
  return block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseSetCookie(line, now))
}

/** Render a parsed cookie back to a Set-Cookie line. */
export function serialise(cookie: ParsedCookie): string {
  const parts = [`${cookie.name}=${cookie.value}`]
  const a = cookie.attributes
  if (a.domain) parts.push(`Domain=${a.domain}`)
  if (a.path) parts.push(`Path=${a.path}`)
  if (a.expires) parts.push(`Expires=${a.expires.toUTCString()}`)
  if (a.maxAge !== undefined) parts.push(`Max-Age=${a.maxAge}`)
  if (a.sameSite && a.sameSite !== 'unknown') parts.push(`SameSite=${a.sameSite}`)
  if (a.secure) parts.push('Secure')
  if (a.httpOnly) parts.push('HttpOnly')
  if (a.partitioned) parts.push('Partitioned')
  for (const [key, value] of a.extra) parts.push(value ? `${key}=${value}` : key)
  return parts.join('; ')
}

export function formatAttributes(cookie: ParsedCookie): string[] {
  const a = cookie.attributes
  const lines: string[] = []
  if (a.domain) lines.push(`Domain: ${a.domain}`)
  if (a.path) lines.push(`Path: ${a.path}`)
  if (a.expires) lines.push(`Expires: ${a.expires.toUTCString()}`)
  if (a.maxAge !== undefined) lines.push(`Max-Age: ${a.maxAge} seconds`)
  if (a.sameSite) lines.push(`SameSite: ${a.sameSite}`)
  lines.push(`Secure: ${a.secure ? 'yes' : 'no'}`)
  lines.push(`HttpOnly: ${a.httpOnly ? 'yes' : 'no'}`)
  if (a.partitioned) lines.push('Partitioned: yes')
  for (const [key, value] of a.extra) lines.push(`${key}: ${value || '(flag)'}`)
  return lines
}
