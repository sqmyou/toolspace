/** Pure helpers for the image converter: formats, sizes and output names. */

export type OutputFormat = 'image/png' | 'image/jpeg' | 'image/webp'

export const OUTPUT_FORMATS: { mime: OutputFormat; label: string; extension: string; supportsQuality: boolean }[] = [
  { mime: 'image/png', label: 'PNG', extension: 'png', supportsQuality: false },
  { mime: 'image/jpeg', label: 'JPEG', extension: 'jpg', supportsQuality: true },
  { mime: 'image/webp', label: 'WebP', extension: 'webp', supportsQuality: true },
]

export interface Dimensions {
  width: number
  height: number
}

export function fitWithin(source: Dimensions, max: Dimensions): Dimensions {
  const safeMax = { width: Math.max(1, Math.floor(max.width)), height: Math.max(1, Math.floor(max.height)) }
  if (source.width <= safeMax.width && source.height <= safeMax.height) {
    return { width: Math.round(source.width), height: Math.round(source.height) }
  }
  const scale = Math.min(safeMax.width / source.width, safeMax.height / source.height)
  return { width: Math.max(1, Math.round(source.width * scale)), height: Math.max(1, Math.round(source.height * scale)) }
}

export function scaleByPercent(source: Dimensions, percent: number): Dimensions {
  const factor = Math.max(1, percent) / 100
  return { width: Math.max(1, Math.round(source.width * factor)), height: Math.max(1, Math.round(source.height * factor)) }
}

export function isSameAspect(a: Dimensions, b: Dimensions): boolean {
  if (a.width === 0 || a.height === 0 || b.width === 0 || b.height === 0) return false
  return Math.abs(a.width / a.height - b.width / b.height) < 0.001
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function outputName(original: string, format: OutputFormat): string {
  const spec = OUTPUT_FORMATS.find((item) => item.mime === format)
  const base = original.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_') || 'image'
  return `${base}.${spec?.extension ?? 'png'}`
}

export function parseDimensions(input: string): number | null {
  const value = Number(input)
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.floor(value)
}

/** Reject formats the browser cannot draw, with a readable reason. */
export function rejectReason(mime: string): string | null {
  if (mime.startsWith('image/svg')) return 'SVG is vector graphics; rasterise it before converting.'
  if (mime === 'image/gif') return 'Animated GIFs will be flattened to a single frame.'
  if (!mime.startsWith('image/')) return 'That file is not an image.'
  return null
}
