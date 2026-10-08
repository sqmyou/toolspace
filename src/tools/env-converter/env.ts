/** Convert between .env, JSON, shell exports and container env formats. */

export interface EnvEntry {
  key: string
  value: string
  comment?: string
}

export type EnvFormat = 'env' | 'json' | 'shell' | 'compose' | 'k8s'

export class EnvError extends Error {}

/** Parse .env text, keeping comments and tolerating quotes and `export`. */
export function parseEnv(text: string): EnvEntry[] {
  const entries: EnvEntry[] = []
  let pending: string | undefined
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    if (line.startsWith('#')) {
      pending = pending ? `${pending}\n${line.slice(1).trim()}` : line.slice(1).trim()
      continue
    }
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_.]*)\s*=\s*(.*)$/.exec(line)
    if (!match) throw new EnvError(`Cannot parse line: ${line}`)
    entries.push({ key: match[1], value: unquote(match[2]), ...(pending ? { comment: pending } : {}) })
    pending = undefined
  }
  return entries
}

function unquote(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2) {
    const first = trimmed[0]
    const last = trimmed[trimmed.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      const inner = trimmed.slice(1, -1)
      return first === '"' ? inner.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\') : inner
    }
  }
  // Strip a trailing inline comment only when the value is unquoted.
  const hash = trimmed.indexOf(' #')
  return hash >= 0 ? trimmed.slice(0, hash).trim() : trimmed
}

function quote(value: string): string {
  return /[\s"'#$&*()|<>?\\!`]/.test(value) || value === ''
    ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
    : value
}

export function toJson(entries: EnvEntry[]): string {
  const out: Record<string, string> = {}
  for (const entry of entries) out[entry.key] = entry.value
  return JSON.stringify(out, null, 2)
}

export function toEnv(entries: EnvEntry[]): string {
  const lines: string[] = []
  for (const entry of entries) {
    if (entry.comment) lines.push(`# ${entry.comment}`)
    lines.push(`${entry.key}=${quote(entry.value)}`)
  }
  return lines.join('\n') + '\n'
}

export function toShell(entries: EnvEntry[]): string {
  return entries.map((entry) => `export ${entry.key}=${shellQuote(entry.value)}`).join('\n') + '\n'
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function toCompose(entries: EnvEntry[]): string {
  const lines = ['environment:']
  if (!entries.length) return 'environment: {}\n'
  for (const entry of entries) lines.push(`  ${entry.key}: ${JSON.stringify(entry.value)}`)
  return lines.join('\n') + '\n'
}

export function toK8s(entries: EnvEntry[]): string {
  const lines = ['env:']
  for (const entry of entries) {
    lines.push(`  - name: ${entry.key}`, `    value: ${JSON.stringify(entry.value)}`)
  }
  return (entries.length ? lines.join('\n') : 'env: []') + '\n'
}

export function convert(entries: EnvEntry[], format: EnvFormat): string {
  switch (format) {
    case 'json':
      return toJson(entries)
    case 'shell':
      return toShell(entries)
    case 'compose':
      return toCompose(entries)
    case 'k8s':
      return toK8s(entries)
    default:
      return toEnv(entries)
  }
}

/** Parse JSON text into entries, if it looks like JSON rather than .env. */
export function parseInput(text: string): EnvEntry[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new EnvError('Expected a JSON object of key/value pairs.')
    }
    return Object.entries(parsed as Record<string, unknown>).map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
    }))
  }
  return parseEnv(text)
}
