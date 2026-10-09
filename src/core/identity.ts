import { el } from './dom'

/**
 * Per-tool visual identity.
 *
 * Tools are not asked to supply artwork — most of the 91 in the tree declare no
 * icon — so every tool gets a *generated* identity derived from its slug. The
 * first pass used one shape for everyone: a 3×3 dot matrix. Nine dots × 91
 * tools is a wall of identical boxes, so identity is now *structural*: a slug
 * picks one of several mark families, and a seeded PRNG varies its parameters.
 *
 * Two ingredients:
 *   - a category hue, so related tools read as a family (the only colour lever);
 *   - a mark, generated from the slug, so tools within a family stay distinct.
 *
 * Marks are drawn on a 24×24 grid with the icon set's stroke weight and round
 * caps, so they read as one family rather than borrowed glyphs.
 */

/** One hue per category, spread around the wheel so families stay legible. */
const CATEGORY_HUES: Record<string, number> = {
  Code: 205,
  Crypto: 275,
  Data: 185,
  Design: 330,
  DevOps: 30,
  Documents: 96,
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

/** The single colour lever: a tool's hue comes from its category. */
export function categoryHue(category: string): number {
  return CATEGORY_HUES[category] ?? FALLBACK_HUE
}

/** FNV-1a. Small, fast and stable, so a slug always draws the same mark. */
function hash(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32 — a tiny deterministic PRNG, so mark parameters vary per slug. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (n: number): number => Math.round(n * 10) / 10
const pt = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const rad = (deg * Math.PI) / 180
  return [round(cx + r * Math.cos(rad)), round(cy + r * Math.sin(rad))]
}

/** A generator draws one variant of a mark family from a seeded RNG. */
type Mark = (r: () => number) => string

/** Two concentric arcs around an optional hub — a radar sweep. */
const arcs: Mark = (r) => {
  const start = -60 + r() * 120
  const sweep = 120 + r() * 60
  const parts = [6, 9.5].map((radius) => {
    const [x1, y1] = pt(12, 12, radius, start)
    const [x2, y2] = pt(12, 12, radius, start + sweep)
    return `<path d="M${x1} ${y1} A${radius} ${radius} 0 0 1 ${x2} ${y2}" stroke="currentColor" stroke-width="1.7" fill="none"/>`
  })
  if (r() > 0.5) parts.push('<circle cx="12" cy="12" r="1.6" fill="currentColor"/>')
  return parts.join('')
}

/** Three to five bars of varying height — an equaliser. */
const bars: Mark = (r) => {
  const n = 3 + Math.floor(r() * 3)
  const gap = 16 / (n + 1)
  const parts: string[] = []
  for (let i = 0; i < n; i += 1) {
    const x = round(4 + gap * (i + 1))
    const h = 5 + r() * 11
    const top = round(12 - h / 2)
    parts.push(`<path d="M${x} ${top} V${round(top + h)}" stroke="currentColor" stroke-width="1.9"/>`)
  }
  return parts.join('')
}

/** A diagonal rail carrying perpendicular rungs — a ladder. */
const ladder: Mark = (r) => {
  const down = r() > 0.5
  const inset = 2.5 + r() * 2.5
  const x0 = round(inset + r())
  const x1 = round(24 - inset - r())
  const y0 = round(down ? inset : 24 - inset - r())
  const y1 = round(down ? 24 - inset - r() : inset)
  const count = 3 + Math.floor(r() * 3)
  const half = 2.4 + r() * 1.8
  // Perpendicular to the rail, so the rungs read as a ladder at any angle.
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const px = round((-dy / len) * half)
  const py = round((dx / len) * half)
  const parts = [`<path d="M${x0} ${y0} L${x1} ${y1}" stroke="currentColor" stroke-width="1.7"/>`]
  for (let i = 1; i <= count; i += 1) {
    const t = i / (count + 1)
    const x = round(x0 + dx * t)
    const y = round(y0 + dy * t)
    parts.push(
      `<path d="M${round(x - px)} ${round(y - py)} L${round(x + px)} ${round(y + py)}" stroke="currentColor" stroke-width="1.7"/>`,
    )
  }
  return parts.join('')
}

/** A ring carrying one to three filled beads. */
const ringBeads: Mark = (r) => {
  const parts = ['<circle cx="12" cy="12" r="7.2" stroke="currentColor" stroke-width="1.7" fill="none"/>']
  const n = 1 + Math.floor(r() * 3)
  const offset = r() * 360
  for (let i = 0; i < n; i += 1) {
    const [x, y] = pt(12, 12, 7.2, offset + (360 / n) * i)
    parts.push(`<circle cx="${x}" cy="${y}" r="1.9" fill="currentColor"/>`)
  }
  return parts.join('')
}

/** Three nodes joined by edges, the first solid. */
const nodes: Mark = (r) => {
  const points = [r() * 360, r() * 360, r() * 360].map((a) => pt(12, 12, 6.5, a))
  const parts = [
    `<path d="M${points[0][0]} ${points[0][1]} L${points[1][0]} ${points[1][1]}" stroke="currentColor" stroke-width="1.6"/>`,
    `<path d="M${points[1][0]} ${points[1][1]} L${points[2][0]} ${points[2][1]}" stroke="currentColor" stroke-width="1.6"/>`,
    `<path d="M${points[2][0]} ${points[2][1]} L${points[0][0]} ${points[0][1]}" stroke="currentColor" stroke-width="1.6"/>`,
  ]
  points.forEach(([x, y], i) => {
    parts.push(
      i === 0
        ? `<circle cx="${x}" cy="${y}" r="2.4" fill="currentColor"/>`
        : `<circle cx="${x}" cy="${y}" r="2.4" stroke="currentColor" stroke-width="1.5" fill="none"/>`,
    )
  })
  return parts.join('')
}

/** Two or three nested chevrons, rotated one of four ways. */
const chevrons: Mark = (r) => {
  const rot = Math.floor(r() * 4) * 90
  const n = 2 + Math.floor(r() * 2)
  const parts: string[] = []
  for (let i = 0; i < n; i += 1) {
    const off = round(8 + i * 5)
    parts.push(
      `<path d="M${off} 8 L${round(off + 5)} 12 L${off} 16" stroke="currentColor" stroke-width="1.8" fill="none"/>`,
    )
  }
  return `<g transform="rotate(${rot} 12 12) translate(${round(-(n - 1) * 2.5)} 0)">${parts.join('')}</g>`
}

/** A starburst: a hub with alternating rays. */
const burst: Mark = (r) => {
  const n = 5 + Math.floor(r() * 3)
  const offset = r() * 90
  const parts = ['<circle cx="12" cy="12" r="1.7" fill="currentColor"/>']
  for (let i = 0; i < n; i += 1) {
    const [x1, y1] = pt(12, 12, 3.4, offset + (360 / n) * i)
    const [x2, y2] = pt(12, 12, i % 2 === 0 ? 8.6 : 6.2, offset + (360 / n) * i)
    parts.push(`<path d="M${x1} ${y1} L${x2} ${y2}" stroke="currentColor" stroke-width="1.7"/>`)
  }
  return parts.join('')
}

/** Two to four squares on a sparse grid, alternating solid and outline. */
const blocks: Mark = (r) => {
  const cells: [number, number][] = [
    [4, 4],
    [13, 4],
    [4, 13],
    [13, 13],
  ]
  // Fisher-Yates, so the chosen subset is a real shuffle rather than the
  // comparator-noise trick, which kept returning the same two cells.
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1))
    ;[cells[i], cells[j]] = [cells[j], cells[i]]
  }
  const n = 2 + Math.floor(r() * 3)
  return cells
    .slice(0, n)
    .map(([x, y], i) => {
      const size = round(4.6 + r() * 2.6)
      const bx = round(x + (r() - 0.5) * 1.6)
      const by = round(y + (r() - 0.5) * 1.6)
      return i % 2 === 0
        ? `<rect x="${bx}" y="${by}" width="${size}" height="${size}" rx="1.5" fill="currentColor"/>`
        : `<rect x="${bx}" y="${by}" width="${size}" height="${size}" rx="1.5" stroke="currentColor" stroke-width="1.7" fill="none"/>`
    })
    .join('')
}

/** A three-quarter spiral. */
const spiral: Mark = (r) => {
  const turns = 1.5 + r() * 0.6
  const steps = 26
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps
    return pt(12, 12, 1.2 + 8.4 * t, t * turns * 360 - 90)
  })
  const d = `M${points[0][0]} ${points[0][1]} ` + points.slice(1).map(([x, y]) => `L${x} ${y}`).join(' ')
  return `<path d="${d}" stroke="currentColor" stroke-width="1.6" fill="none"/>`
}

/** Two offset waves. */
const wave: Mark = (r) => {
  const amp = 3.5 + r() * 3
  const phase = r()
  const rows = r() > 0.4 ? 2 : 3
  const parts: string[] = []
  for (let i = 0; i < rows; i += 1) {
    const y = round(7 + (14 / (rows - 1 || 1)) * i + (phase - 0.5) * 2)
    const a = round(amp * (0.7 + r() * 0.6))
    parts.push(
      `<path d="M4 ${y} C7 ${round(y - a)} 9 ${round(y + a)} 12 ${y} S17 ${round(y - a)} 20 ${y}" stroke="currentColor" stroke-width="1.7" fill="none"/>`,
    )
  }
  return parts.join('')
}

const MARKS: Mark[] = [arcs, bars, ladder, ringBeads, nodes, chevrons, burst, blocks, spiral, wave]

/**
 * The inner SVG for a slug: a mark family plus its seeded parameters. Pure and
 * exported so the mark set can be tested without a DOM.
 */
export function toolMarkSvg(slug: string): string {
  const r = rng(hash(slug))
  // Draw the family from the PRNG rather than the low hash bits: the same
  // generator then governs the variant, so family and shape vary together.
  return MARKS[Math.floor(r() * MARKS.length)](r)
}

/** A square badge holding the tool's mark, tinted with its category hue. */
export function sigilTile(slug: string, category: string, size = 34): HTMLElement {
  const svg =
    `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${toolMarkSvg(slug)}</svg>`
  return el('span', {
    class: 'ts-sigil',
    'aria-hidden': 'true',
    style: `--h:${categoryHue(category)};width:${size}px;height:${size}px`,
    innerHTML: svg,
  })
}
