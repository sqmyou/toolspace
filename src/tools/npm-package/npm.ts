/**
 * npm package facts from the public registry and download APIs.
 *
 * A *network* tool: it looks up the package name you type, so it declares
 * itself with `remote`. Parsing is pure and takes the raw JSON, so the shape
 * handling is tested without a network call.
 */

const REGISTRY = 'https://registry.npmjs.org'
const DOWNLOADS = 'https://api.npmjs.org/downloads/point'

/**
 * A valid npm package name: optional scope, lowercase, may contain `-._~`
 * but never starts with a dot or underscore. This mirrors npm's own rules
 * closely enough to block anything that would need escaping in the URL.
 */
const NAME_RE = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/

/** Strip the common ways a package gets pasted: a URL, or `pkg@version`. */
export function normalizePackage(input: string): string | null {
  let value = input.trim()
  if (value === '') return null

  const npmUrl = /^https?:\/\/(?:www\.)?npmjs\.com\/package\/([^?#]+)/.exec(value)
  if (npmUrl) value = decodeURIComponent(npmUrl[1])

  // Drop a trailing `@version` or `@tag`, keeping a scope's leading `@`.
  const at = value.lastIndexOf('@')
  if (at > 0) value = value.slice(0, at)

  value = value.replace(/\/+$/, '').replace(/^\s+|\s+$/g, '')
  if (value.length > 214) return null
  if (!NAME_RE.test(value)) return null
  return value
}

export function manifestUrl(name: string): string {
  return `${REGISTRY}/${name.replace('/', '%2f')}/latest`
}

export function downloadsUrl(name: string, period: 'last-week' | 'last-month' | 'last-day' = 'last-week'): string {
  return `${DOWNLOADS}/${period}/${name.replace('/', '%2f')}`
}

export interface PackageFacts {
  name: string
  version: string
  description: string
  license: string
  homepage: string
  repository: string
  dependencies: number
  maintainers: number
  unpackedSize: number
  published: string
}

/** Parse a registry manifest. Pure. */
export function parseManifest(payload: unknown): PackageFacts | null {
  if (typeof payload !== 'object' || payload === null) return null
  const data = payload as Record<string, unknown>
  if (typeof data.name !== 'string') return null
  const repo = data.repository as { url?: unknown } | string | undefined
  const dist = data.dist as { unpackedSize?: unknown } | undefined
  return {
    name: data.name,
    version: typeof data.version === 'string' ? data.version : '',
    description: typeof data.description === 'string' ? data.description : '',
    license: typeof data.license === 'string' ? data.license : '',
    homepage: typeof data.homepage === 'string' ? data.homepage : '',
    repository: typeof repo === 'string' ? repo : typeof repo?.url === 'string' ? repo.url : '',
    dependencies: data.dependencies && typeof data.dependencies === 'object' ? Object.keys(data.dependencies).length : 0,
    maintainers: Array.isArray(data.maintainers) ? data.maintainers.length : 0,
    unpackedSize: typeof dist?.unpackedSize === 'number' ? dist.unpackedSize : 0,
    published: '',
  }
}

/** Parse the downloads endpoint. Pure. */
export function parseDownloads(payload: unknown): number | null {
  if (typeof payload !== 'object' || payload === null) return null
  const value = (payload as { downloads?: unknown }).downloads
  return typeof value === 'number' ? value : null
}

/** Human-readable byte size, e.g. "178.7 kB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '\u2014'
  const units = ['B', 'kB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit += 1
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

/** Compact count, e.g. "186.3M". */
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '\u2014'
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`
  return String(value)
}
