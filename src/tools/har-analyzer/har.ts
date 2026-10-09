/**
 * HAR (HTTP Archive) analysis.
 *
 * A HAR is the JSON that browser devtools export from the Network panel. The
 * shape is fixed by the spec (`.har` files use a `log.entries[]` array), so the
 * analysis is pure functions over the parsed object — no DOM, no network.
 */

export class HarError extends Error {}

export interface HarEntry {
  startedDateTime?: string
  time?: number
  request?: {
    method?: string
    url?: string
    headers?: { name?: string; value?: string }[]
    queryString?: { name?: string; value?: string }[]
    postData?: { mimeType?: string; text?: string; size?: number }
  }
  response?: {
    status?: number
    statusText?: string
    headers?: { name?: string; value?: string }[]
    content?: { size?: number; mimeType?: string; compression?: number }
    redirectURL?: string
  }
  serverIPAddress?: string
  cache?: Record<string, unknown>
  timings?: Record<string, number | undefined>
}

export interface HarLog {
  version?: string
  creator?: { name?: string; version?: string }
  entries?: HarEntry[]
}

export interface HarDocument {
  log?: HarLog
}

export interface RequestRow {
  method: string
  url: string
  path: string
  host: string
  status: number
  statusText: string
  mimeType: string
  /** Total time in milliseconds. */
  time: number
  /** Decoded body size in bytes, when the response reports one. */
  size: number
  /** Content-Encoding the server used, if any. */
  encoding: string
  cached: boolean
  error: boolean
}

export interface Group {
  label: string
  count: number
  bytes: number
}

export interface HarReport {
  version: string
  creator: string
  entries: RequestRow[]
  requestCount: number
  /** Sum of decoded body sizes. */
  totalBytes: number
  /** Wall-clock span from the first to the last started request, when present. */
  pageSpanMs: number | null
  /** Sum of every request's own duration — the work done, not the clock. */
  totalTimeMs: number
  slowest: RequestRow[]
  heaviest: RequestRow[]
  domains: Group[]
  types: Group[]
  methods: Group[]
  statuses: Group[]
  failures: RequestRow[]
  redirects: RequestRow[]
  cachedCount: number
  hasQueryStrings: number
  usesHttp: RequestRow[]
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Response body size: `content.size` after decoding, `-1` when unknown. */
function bodySize(entry: HarEntry): number {
  const size = asNumber(entry.response?.content?.size)
  return size > 0 ? size : 0
}

function headerValue(headers: { name?: string; value?: string }[] | undefined, wanted: string): string {
  const lower = wanted.toLowerCase()
  const match = headers?.find((header) => (header.name ?? '').toLowerCase() === lower)
  return match?.value ?? ''
}

function safeHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return ''
  }
}

function safePath(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}

function groupBy(rows: RequestRow[], pick: (row: RequestRow) => string): Group[] {
  const map = new Map<string, Group>()
  for (const row of rows) {
    const label = pick(row) || '(none)'
    const group = map.get(label) ?? { label, count: 0, bytes: 0 }
    group.count++
    group.bytes += row.size
    map.set(label, group)
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.bytes - a.bytes)
}

/** Parse a HAR document, rejecting anything that is not one. */
export function parseHar(text: string): HarDocument {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    throw new HarError(err instanceof Error ? `Invalid JSON: ${err.message}` : 'Invalid JSON.')
  }
  if (!parsed || typeof parsed !== 'object') throw new HarError('A HAR file is a JSON object.')
  const log = (parsed as HarDocument).log
  if (!log || typeof log !== 'object') throw new HarError('This JSON has no "log" object, so it is not a HAR file.')
  if (log.entries !== undefined && !Array.isArray(log.entries)) throw new HarError('"log.entries" must be an array.')
  return parsed as HarDocument
}

function toRow(entry: HarEntry): RequestRow {
  const url = entry.request?.url ?? ''
  const status = asNumber(entry.response?.status)
  const encoding = headerValue(entry.response?.headers, 'content-encoding')
  return {
    method: (entry.request?.method ?? 'GET').toUpperCase(),
    url,
    path: safePath(url),
    host: safeHost(url) || '(relative)',
    status,
    statusText: entry.response?.statusText ?? '',
    mimeType: entry.response?.content?.mimeType ?? '',
    time: asNumber(entry.time),
    size: bodySize(entry),
    encoding,
    cached: status === 304 || headerValue(entry.response?.headers, 'x-cache') !== '',
    error: status === 0 || status >= 400,
  }
}

/** Turn a parsed HAR into a report: totals, rankings and groupings. */
export function analyseHar(document: HarDocument): HarReport {
  const log = document.log ?? {}
  const entries = log.entries ?? []
  const rows = entries.map(toRow)

  const totalBytes = rows.reduce((sum, row) => sum + row.size, 0)
  const totalTimeMs = rows.reduce((sum, row) => sum + row.time, 0)

  let pageSpanMs: number | null = null
  const starts = entries
    .map((entry) => (entry.startedDateTime ? Date.parse(entry.startedDateTime) : NaN))
    .filter((value) => !Number.isNaN(value))
  if (starts.length > 1) pageSpanMs = Math.max(...starts) - Math.min(...starts)

  const slowest = [...rows].sort((a, b) => b.time - a.time).slice(0, 10)
  const heaviest = [...rows].sort((a, b) => b.size - a.size).slice(0, 10)

  return {
    version: log.version ?? '1.2',
    creator: [log.creator?.name, log.creator?.version].filter(Boolean).join(' ') || 'unknown',
    entries: rows,
    requestCount: rows.length,
    totalBytes,
    pageSpanMs,
    totalTimeMs,
    slowest,
    heaviest,
    domains: groupBy(rows, (row) => row.host),
    types: groupBy(rows, (row) => mimeFamily(row.mimeType)),
    methods: groupBy(rows, (row) => row.method),
    statuses: groupBy(rows, (row) => `${Math.floor(row.status / 100)}xx`),
    failures: rows.filter((row) => row.error),
    redirects: rows.filter((row) => row.status >= 300 && row.status < 400),
    cachedCount: rows.filter((row) => row.cached).length,
    hasQueryStrings: rows.filter((row) => row.url.includes('?')).length,
    usesHttp: rows.filter((row) => row.url.startsWith('http://')),
  }
}

/** Collapse a MIME type to its family, e.g. `application/json` -> `data`. */
export function mimeFamily(mimeType: string): string {
  const mime = mimeType.split(';')[0].trim().toLowerCase()
  if (!mime) return 'unknown'
  if (mime.startsWith('text/css')) return 'css'
  if (mime.includes('javascript') || mime.includes('ecmascript')) return 'script'
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('font/') || mime.includes('font-')) return 'font'
  if (mime.startsWith('video/') || mime.startsWith('audio/')) return 'media'
  if (mime.startsWith('text/html')) return 'html'
  if (mime.startsWith('text/')) return 'text'
  if (mime.includes('json') || mime.includes('xml')) return 'data'
  return 'other'
}

/** Human-readable byte size, e.g. `1.4 MB`. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'kB', 'MB', 'GB']
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1000)))
  const value = bytes / 1000 ** exponent
  const decimals = exponent === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${Number(value.toFixed(decimals))} ${units[exponent]}`
}

/** Human-readable duration, e.g. `820 ms` or `1.24 s`. */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '0 ms'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}
