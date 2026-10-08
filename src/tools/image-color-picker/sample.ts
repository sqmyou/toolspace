/**
 * Pure sampling maths for the image colour picker.
 *
 * The DOM half (drawing the image to a canvas and reading pixels) lives in
 * `index.ts`; everything here works on a plain pixel array so it can be
 * tested without a browser.
 */

import { contrastRatio, relativeLuminance, toHex, type Rgb } from '../color-converter/color'

export interface Sample {
  hex: string
  rgb: Rgb
  /** Share of the sampled pixels that are this exact colour, 0-1. */
  share: number
}

function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '')
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  }
}

/**
 * Group sampled pixels into colours, most common first.
 *
 * `precision` buckets each channel, so 2 collapses the 256 levels down to 64
 * and near-identical shades merge into one entry. The bucket's average colour
 * is reported rather than the first pixel seen, which keeps the swatch
 * representative of the whole cluster.
 */
export function dominantColors(pixels: string[], limit = 12, precision = 2): Sample[] {
  if (pixels.length === 0) return []
  const step = Math.max(1, Math.round(256 / Math.pow(2, precision)))

  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>()
  for (const hex of pixels) {
    const { r, g, b } = hexToRgb(hex)
    const key = `${Math.floor(r / step)}:${Math.floor(g / step)}:${Math.floor(b / step)}`
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.r += r
      bucket.g += g
      bucket.b += b
      bucket.count += 1
    } else {
      buckets.set(key, { r, g, b, count: 1 })
    }
  }

  const total = pixels.length
  return [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((bucket) => {
      const rgb = {
        r: Math.round(bucket.r / bucket.count),
        g: Math.round(bucket.g / bucket.count),
        b: Math.round(bucket.b / bucket.count),
      }
      return { hex: toHex(rgb), rgb, share: bucket.count / total }
    })
}

/** Ink that stays readable on a swatch: near-black or near-white. */
export function readableInk(rgb: Rgb): string {
  return relativeLuminance(rgb) > 0.45 ? '#10131a' : '#ffffff'
}

/** The WCAG contrast ratio between a swatch and white, for a quick sanity check. */
export function contrastWithWhite(rgb: Rgb): number {
  return contrastRatio(rgb, { r: 255, g: 255, b: 255 })
}

export function formatPercent(share: number): string {
  const pct = share * 100
  if (pct >= 10) return `${pct.toFixed(0)}%`
  if (pct >= 1) return `${pct.toFixed(1)}%`
  return `${pct.toFixed(2)}%`
}

/** CSS custom-property block for the current palette, ready to copy. */
export function paletteToCss(samples: Sample[]): string {
  const lines = samples.map((sample, index) => `  --color-${index + 1}: ${sample.hex};`)
  return `:root {\n${lines.join('\n')}\n}`
}

/** `["#aabbcc", ...]` for pasting into a design tool. */
export function paletteToList(samples: Sample[]): string {
  return samples.map((sample) => sample.hex).join('\n')
}
