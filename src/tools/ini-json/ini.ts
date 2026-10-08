/**
 * INI parsing and serialisation.
 *
 * Keys that appear before any section land under an empty-string section so
 * that a round trip keeps them at the top of the file. Only whole-line
 * comments are treated as comments; a `#` inside a value is left alone,
 * because that is the least surprising rule for config files.
 */

export interface IniParseResult {
  /** Section name -> key/value pairs. The "" key holds top-level entries. */
  data: Record<string, Record<string, string>>
  warnings: string[]
}

export function parseIni(text: string): IniParseResult {
  const data: Record<string, Record<string, string>> = { '': {} }
  const warnings: string[] = []
  let section = ''

  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  lines.forEach((raw, index) => {
    const line = raw.trim()
    if (!line || line.startsWith(';') || line.startsWith('#')) return

    const header = /^\[(.+)]$/.exec(line)
    if (header) {
      section = header[1].trim()
      if (!section) {
        warnings.push(`Line ${index + 1}: empty section name`)
        section = ''
        return
      }
      if (section in data) warnings.push(`Line ${index + 1}: duplicate section [${section}]`)
      else data[section] = {}
      return
    }

    const eq = line.indexOf('=')
    if (eq < 0) {
      warnings.push(`Line ${index + 1}: ignored "${line}" (no "=")`)
      return
    }

    const key = line.slice(0, eq).trim()
    if (!key) {
      warnings.push(`Line ${index + 1}: ignored an entry with no key`)
      return
    }
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"') && value.length >= 2) || (value.startsWith("'") && value.endsWith("'") && value.length >= 2)) {
      value = value.slice(1, -1)
    }

    if (key in data[section]) warnings.push(`Line ${index + 1}: "${key}" in [${section || 'top level'}] overrides an earlier value`)
    data[section][key] = value
  })

  // Drop the top-level bucket when it stayed empty.
  if (Object.keys(data['']).length === 0 && Object.keys(data).length > 1) delete data['']

  return { data, warnings }
}

function needsQuoting(value: string): boolean {
  return /[#;=\n]/.test(value) || /^\s|\s$/.test(value)
}

function formatValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object') return JSON.stringify(value)
  const text = String(value)
  return needsQuoting(text) ? JSON.stringify(text) : text
}

/**
 * Serialise a plain object to INI.
 *
 * A value that is a plain object becomes a section; anything else is written
 * as a top-level key. Deeper nesting is stored as JSON so no data is lost.
 */
export function toIni(data: Record<string, unknown>): string {
  const globals: [string, unknown][] = []
  const sections: [string, Record<string, unknown>][] = []

  for (const [key, value] of Object.entries(data)) {
    if (key === '' && value && typeof value === 'object' && !Array.isArray(value)) {
      // The "" bucket from the parser is the file's top-level keys.
      globals.push(...Object.entries(value as Record<string, unknown>))
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sections.push([key, value as Record<string, unknown>])
    } else {
      globals.push([key, value])
    }
  }

  const lines: string[] = []
  for (const [key, value] of globals) lines.push(`${key} = ${formatValue(value)}`)

  for (const [name, body] of sections) {
    if (lines.length) lines.push('')
    lines.push(`[${name}]`)
    for (const [key, value] of Object.entries(body)) lines.push(`${key} = ${formatValue(value)}`)
  }

  return lines.length ? `${lines.join('\n')}\n` : ''
}
