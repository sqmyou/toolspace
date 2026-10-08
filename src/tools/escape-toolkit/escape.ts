/** Escape and unescape a string for many common contexts. */

export type Flavor = 'json' | 'js' | 'html' | 'xml' | 'url' | 'sql' | 'shell' | 'regex' | 'csv'

export interface FlavorMeta {
  value: Flavor
  label: string
}

export const FLAVORS: FlavorMeta[] = [
  { value: 'json', label: 'JSON' },
  { value: 'js', label: 'JavaScript' },
  { value: 'html', label: 'HTML' },
  { value: 'xml', label: 'XML' },
  { value: 'url', label: 'URL component' },
  { value: 'sql', label: 'SQL' },
  { value: 'shell', label: 'Shell (single quotes)' },
  { value: 'regex', label: 'Regex' },
  { value: 'csv', label: 'CSV field' },
]

const HTML_ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\/]/g

export function escape(text: string, flavor: Flavor): string {
  switch (flavor) {
    case 'json':
    case 'js':
      return JSON.stringify(text).slice(1, -1)
    case 'html':
    case 'xml':
      return text.replace(/[&<>"']/g, (c) => HTML_ENTITIES[c])
    case 'url':
      return encodeURIComponent(text)
    case 'sql':
      return text.replace(/'/g, "''")
    case 'shell':
      return `'${text.replace(/'/g, `'\\''`)}'`
    case 'regex':
      return text.replace(REGEX_SPECIAL, '\\$&')
    case 'csv': {
      // Spreadsheet apps treat a leading = + - @ as a formula, so neutralise it.
      const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text
      return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
    }
    default:
      return text
  }
}

export function unescape(text: string, flavor: Flavor): string {
  switch (flavor) {
    case 'json':
    case 'js':
      try {
        return JSON.parse(`"${text.replace(/"/g, '\\"')}"`)
      } catch {
        return JSON.parse(`"${text.replace(/(?<!\\)"/g, '\\"')}"`)
      }
    case 'html':
    case 'xml':
      return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
        if (body[0] === '#') {
          const hex = body[1] === 'x' || body[1] === 'X'
          const code = parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10)
          return Number.isFinite(code) ? String.fromCodePoint(code) : whole
        }
        return NAMED_ENTITIES[body.toLowerCase()] ?? whole
      })
    case 'url':
      return decodeURIComponent(text)
    case 'sql':
      return text.replace(/''/g, "'")
    case 'shell': {
      const trimmed = text.trim()
      if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
        return trimmed.slice(1, -1).replace(/'\\''/g, "'")
      }
      return text
    }
    case 'regex':
      return text.replace(/\\([.*+?^${}()|[\]\\/])/g, '$1')
    case 'csv': {
      const trimmed = text.trim()
      const inner = trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1).replace(/""/g, '"') : trimmed
      return inner.startsWith("'") && /^'[=+\-@]/.test(inner) ? inner.slice(1) : inner
    }
    default:
      return text
  }
}
