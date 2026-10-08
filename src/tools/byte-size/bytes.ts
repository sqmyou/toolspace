/**
 * Human-readable byte sizes.
 *
 * Decimal units (kB, MB) use powers of 1000; binary units (KiB, MiB) use
 * powers of 1024. The distinction matters: a "1 GB" disk is about 0.93 GiB,
 * and pretending otherwise is where most size bugs come from.
 */

const BINARY = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB']
const DECIMAL = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB']

export interface FormatOptions {
  /** Use powers of 1024 and IEC names instead of powers of 1000 and SI names. */
  binary?: boolean
  /** Digits after the decimal point. */
  decimals?: number
  /** Always show this many significant unit steps, even for whole numbers. */
  fixedUnit?: string
}

export class ByteSizeError extends Error {}

/** Format a byte count with a unit suffix. */
export function formatBytes(bytes: number, options: FormatOptions = {}): string {
  if (!Number.isFinite(bytes)) throw new ByteSizeError('Enter a finite number of bytes')
  const binary = options.binary ?? false
  const decimals = Math.max(0, Math.min(10, options.decimals ?? 2))
  const units = binary ? BINARY : DECIMAL
  const step = binary ? 1024 : 1000
  const sign = bytes < 0 ? '-' : ''
  let value = Math.abs(bytes)

  let index = 0
  let label = ''
  if (options.fixedUnit) {
    // A pinned unit may come from either scale, so look in both lists and use
    // the matching scale's step.
    const found = units.indexOf(options.fixedUnit)
    const other = found < 0 ? (binary ? DECIMAL : BINARY).indexOf(options.fixedUnit) : -1
    if (found < 0 && other < 0) throw new ByteSizeError(`Unknown unit "${options.fixedUnit}"`)
    index = found >= 0 ? found : other
    label = options.fixedUnit
    value /= (found >= 0 ? step : binary ? 1000 : 1024) ** index
  } else {
    while (value >= step && index < units.length - 1) {
      value /= step
      index += 1
    }
    label = units[index]
  }

  // Whole bytes never need decimals.
  const digits = index === 0 ? 0 : decimals
  const rounded = Number(value.toFixed(digits))
  return `${sign}${rounded} ${label}`
}

export interface ParsedSize {
  bytes: number
  unit: string
}

const UNITS: Record<string, number> = {
  b: 1,
  byte: 1,
  bytes: 1,
  kb: 1000,
  k: 1000,
  kib: 1024,
  mb: 1000 ** 2,
  m: 1000 ** 2,
  mib: 1024 ** 2,
  gb: 1000 ** 3,
  g: 1000 ** 3,
  gib: 1024 ** 3,
  tb: 1000 ** 4,
  t: 1000 ** 4,
  tib: 1024 ** 4,
  pb: 1000 ** 5,
  pib: 1024 ** 5,
}

/** Parse strings such as "1.5 MB", "2GiB" or "512" into a byte count. */
export function parseBytes(input: string): ParsedSize {
  const text = input.trim()
  if (!text) throw new ByteSizeError('Enter a size such as "1.5 MB"')
  const match = /^([+-]?[\d.]+(?:e[+-]?\d+)?)\s*([a-z]*)$/i.exec(text)
  if (!match) throw new ByteSizeError(`Cannot read "${input}" as a size`)

  const value = Number(match[1])
  if (Number.isNaN(value)) throw new ByteSizeError(`"${match[1]}" is not a number`)

  const unitText = match[2].toLowerCase()
  if (unitText && !(unitText in UNITS)) throw new ByteSizeError(`Unknown unit "${match[2]}"`)
  const multiplier = unitText ? UNITS[unitText] : 1

  return { bytes: value * multiplier, unit: unitText || 'b' }
}

/** All common representations of one byte count, for side-by-side comparison. */
export function breakdown(bytes: number): { label: string; value: string }[] {
  return [
    { label: 'Bytes', value: `${bytes} B` },
    { label: 'Decimal', value: formatBytes(bytes, { binary: false }) },
    { label: 'Binary', value: formatBytes(bytes, { binary: true }) },
    { label: 'Bits', value: `${bytes * 8} bit` },
    { label: 'Kilobytes', value: formatBytes(bytes, { fixedUnit: 'kB', decimals: 3 }) },
    { label: 'Kibibytes', value: formatBytes(bytes, { fixedUnit: 'KiB', decimals: 3 }) },
  ]
}
