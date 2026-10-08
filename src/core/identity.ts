import { el } from './dom'

/**
 * Per-tool visual identity.
 *
 * Tools are not asked to supply artwork — 84 of the 85 in the tree declare no
 * icon, which is why a catalogue of them reads as a wall of identical boxes.
 * Instead every tool gets a *generated* identity, derived from its slug, so
 * the grid varies on its own without a contributor drawing anything.
 *
 * Two ingredients:
 *   - a category hue, so related tools read as a family;
 *   - a "sigil": a small 3x3 dot matrix, stable for a given slug, so no two
 *     tools in a category look alike.
 */

/** One hue per category, spread around the wheel so families stay legible. */
const CATEGORY_HUES: Record<string, number> = {
  Code: 205,
  Crypto: 275,
  Data: 185,
  Design: 330,
  DevOps: 30,
  Encoding: 158,
  Math: 292,
  Media: 315,
  Network: 225,
  Numbers: 48,
  Regex: 350,
  Security: 3,
  Text: 130,
  Time: 246,
  Web: 172,
}

const FALLBACK_HUE = 205

export function categoryHue(category: string): number {
  return CATEGORY_HUES[category] ?? FALLBACK_HUE
}

/** FNV-1a. Small, fast and stable, so a slug always draws the same sigil. */
function hash(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

const GRID = 3
const CELL = 8
const PAD = 3
const SPAN = GRID * CELL + PAD * 2

/**
 * Which of the nine cells are lit. The raw hash can come out nearly empty or
 * nearly full, which reads as a mistake rather than a mark, so anything
 * outside 3-6 lit cells is inverted into that band.
 */
function litCells(slug: string): boolean[] {
  const bits = hash(slug)
  const cells = Array.from({ length: GRID * GRID }, (_, i) => ((bits >>> i) & 1) === 1)
  const lit = cells.filter(Boolean).length
  return lit < 3 || lit > 6 ? cells.map((on) => !on) : cells
}

function sigilSvg(slug: string): string {
  const parts = [
    `<rect x="0.5" y="0.5" width="${SPAN - 1}" height="${SPAN - 1}" rx="9" class="ts-sigil-frame"/>`,
  ]
  litCells(slug).forEach((on, i) => {
    if (!on) return
    const x = PAD + (i % GRID) * CELL + CELL / 2
    const y = PAD + Math.floor(i / GRID) * CELL + CELL / 2
    parts.push(`<circle cx="${x}" cy="${y}" r="2.35" class="ts-sigil-dot"/>`)
  })
  return `<svg viewBox="0 0 ${SPAN} ${SPAN}" width="100%" height="100%" fill="none" aria-hidden="true">${parts.join('')}</svg>`
}

/** A square badge holding the tool's sigil, tinted with its category hue. */
export function sigilTile(slug: string, category: string, size = 34): HTMLElement {
  return el('span', {
    class: 'ts-sigil',
    'aria-hidden': 'true',
    style: `--h:${categoryHue(category)};width:${size}px;height:${size}px`,
    innerHTML: sigilSvg(slug),
  })
}
