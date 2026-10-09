import { el } from './dom'

/**
 * Per-tool visual identity.
 *
 * Tools are not asked to supply artwork, so every tool gets a *generated*
 * identity derived from its slug. A first pass used one shape for everyone (a
 * 3×3 dot matrix), which read as a wall of identical boxes; identity is now
 * *structural*: the category chooses a pool of mark families that mean
 * something for that kind of tool, and a seeded PRNG varies each drawn mark.
 *
 * Two ingredients:
 *   - a category hue *and* a category mark pool, so related tools read as a
 *     family and an unrelated one cannot borrow its shape;
 *   - a mark generated from the slug, so tools inside a family stay distinct.
 *
 * Marks are drawn on a 24×24 grid and consume `currentColor`, which the badge
 * sets from the theme accent (see `main.css`), so the whole set follows the
 * palette rather than a fixed hue.
 */

/** One hue per family, spread around the wheel so families stay legible. */
const CATEGORY_HUES: Record<string, number> = {
  Data: 186,
  Text: 132,
  Numbers: 48,
  Security: 5,
  Web: 224,
  Code: 266,
  Media: 302,
  Design: 340,
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

/** A polygon with a fixed number of sides, optionally rotated and filled. */
function polygon(cx: number, cy: number, radius: number, sides: number, rotation = 0, filled = false): string {
  const points = Array.from({ length: sides }, (_, i) => pt(cx, cy, radius, rotation + (360 / sides) * i))
  const d = `M${points[0][0]} ${points[0][1]} ` + points.slice(1).map(([x, y]) => `L${x} ${y}`).join(' ') + ' Z'
  return filled
    ? `<path d="${d}" fill="currentColor"/>`
    : `<path d="${d}" stroke="currentColor" stroke-width="1.7" fill="none"/>`
}

/** --- Generic families ------------------------------------------------------ */

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
  // Vary the x1/x2 extremes and the stroke, so two chevron tools at the same
  // rotation and count still differ in size and weight.
  const x1 = round(6.8 + r() * 1.6)
  const x2 = round(11.2 + r() * 2)
  const half = round(2.6 + r() * 2)
  const weight = round(1.5 + r() * 0.6)
  const parts: string[] = []
  for (let i = 0; i < n; i += 1) {
    const off = round(2.8 + i * (4.4 + r() * 1.4))
    parts.push(
      `<path d="M${round(x1 + off)} ${round(12 - half - off * 0.4)} L${round(x2 + off)} 12 L${round(x1 + off)} ${round(12 + half + off * 0.4)}" stroke="currentColor" stroke-width="${weight}" fill="none"/>`,
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
  const phase = r() > 0.5 ? 1 : 0
  const rows = r() > 0.4 ? 2 : 3
  const parts: string[] = []
  for (let i = 0; i < rows; i += 1) {
    const y = round(7 + (14 / (rows - 1 || 1)) * i)
    const a = round(amp * (0.7 + r() * 0.6))
    const up = (phase + i) % 2 ? round(y + a) : round(y - a)
    const down = (phase + i) % 2 ? round(y - a) : round(y + a)
    parts.push(
      `<path d="M4 ${y} C7 ${up} 9 ${down} 12 ${y} S17 ${up} 20 ${y}" stroke="currentColor" stroke-width="1.7" fill="none"/>`,
    )
  }
  return parts.join('')
}

/** --- Domain families ------------------------------------------------------- */

/** Horizontal document lines with a folded corner — a parsing motif. */
const docLines: Mark = (r) => {
  const rows = 3 + Math.floor(r() * 2)
  const fold = r() > 0.5
  const parts = [
    fold
      ? `<path d="M6 4.4h7.4L18 9v10.6H6z" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M13.4 4.4V9H18" stroke="currentColor" stroke-width="1.6" fill="none"/>`
      : `<rect x="6" y="4.4" width="12" height="15.2" rx="1.8" stroke="currentColor" stroke-width="1.6" fill="none"/>`,
  ]
  const step = 12.4 / (rows + 1)
  for (let i = 1; i <= rows; i += 1) {
    const y = round(4.4 + step * i + 1.4)
    // Vary each rule's length continuously, so two "document" tools still read
    // as different documents rather than the same three lines.
    const end = round(8.8 + 4.2 + r() * 3.4)
    parts.push(`<path d="M8.8 ${y} H${end}" stroke="currentColor" stroke-width="1.5"/>`)
  }
  return parts.join('')
}

/** Interlocking or facing brackets — a code/config motif. */
const brackets: Mark = (r) => {
  const inset = 3.4 + r() * 1.6
  const depth = 3.4 + r() * 1.4
  const mid = 12
  if (r() > 0.5) {
    const top = round(inset + r() * 0.8)
    const bottom = round(24 - inset - r() * 0.8)
    return (
      `<path d="M${round(inset + depth)} ${top} L${inset} ${top} L${inset} ${bottom} L${round(inset + depth)} ${bottom}" stroke="currentColor" stroke-width="1.8" fill="none"/>` +
      `<path d="M${round(24 - inset - depth)} ${top} L${round(24 - inset)} ${top} L${round(24 - inset)} ${bottom} L${round(24 - inset - depth)} ${bottom}" stroke="currentColor" stroke-width="1.8" fill="none"/>`
    )
  }
  const top = round(6 + r() * 0.8)
  const bottom = round(18 - r() * 0.8)
  const depth2 = round(2.6 + r() * 0.8)
  return (
    `<path d="M${round(mid - 2)} ${top} L${round(mid - 2 - depth2)} ${mid} L${round(mid - 2)} ${bottom}" stroke="currentColor" stroke-width="1.8" fill="none"/>` +
    `<path d="M${round(mid + 2)} ${top} L${round(mid + 2 + depth2)} ${mid} L${round(mid + 2)} ${bottom}" stroke="currentColor" stroke-width="1.8" fill="none"/>`
  )
}

/** A table grid with one cell highlighted — a spreadsheet motif. */
const gridCell: Mark = (r) => {
  const size = 14.5 + r() * 1.4
  const cols = 2 + Math.floor(r() * 2)
  const rows = 2 + Math.floor(r() * 2)
  const cell = size / Math.max(cols, rows)
  // A little jitter on the origin and highlight inset keeps two grids from
  // rendering byte-identical when they land on the same cols/rows/highlight.
  const x0 = round(12 - (cell * cols) / 2 + (r() - 0.5) * 0.6)
  const y0 = round(12 - (cell * rows) / 2 + (r() - 0.5) * 0.6)
  const hx = Math.floor(r() * cols)
  const hy = Math.floor(r() * rows)
  const parts = [
    `<rect x="${x0}" y="${y0}" width="${round(cell * cols)}" height="${round(cell * rows)}" rx="1.6" stroke="currentColor" stroke-width="1.6" fill="none"/>`,
  ]
  for (let c = 1; c < cols; c += 1) parts.push(`<path d="M${round(x0 + cell * c)} ${y0} V${round(y0 + cell * rows)}" stroke="currentColor" stroke-width="1.4"/>`)
  for (let rr = 1; rr < rows; rr += 1) parts.push(`<path d="M${x0} ${round(y0 + cell * rr)} H${round(x0 + cell * cols)}" stroke="currentColor" stroke-width="1.4"/>`)
  const pad = round(0.5 + r() * 0.6)
  parts.push(
    `<rect x="${round(x0 + cell * hx + pad)}" y="${round(y0 + cell * hy + pad)}" width="${round(cell - pad * 2)}" height="${round(cell - pad * 2)}" rx="1.1" fill="currentColor"/>`,
  )
  return parts.join('')
}

/** A letterform "T" bar — a text motif. */
const typeMark: Mark = (r) => {
  const w = 5.6 + r() * 3
  const parts = [
    `<path d="M${round(12 - w)} 7 H${round(12 + w)}" stroke="currentColor" stroke-width="1.9"/>`,
    `<path d="M12 7 V17.4" stroke="currentColor" stroke-width="1.9"/>`,
  ]
  if (r() > 0.5) parts.push(`<path d="M8.6 17.4 H15.4" stroke="currentColor" stroke-width="1.9"/>`)
  return parts.join('')
}

/** A dial with a needle — a numeric/measure motif. */
const dial: Mark = (r) => {
  const start = 200 + r() * 20
  const sweep = 120 + r() * 20
  const [x1, y1] = pt(12, 12, 8, start)
  const [x2, y2] = pt(12, 12, 8, start + sweep)
  const [nx, ny] = pt(12, 12, 6.4, 120 + r() * 120)
  return (
    `<path d="M${x1} ${y1} A8 8 0 0 1 ${x2} ${y2}" stroke="currentColor" stroke-width="1.7" fill="none"/>` +
    `<path d="M12 12 L${nx} ${ny}" stroke="currentColor" stroke-width="1.7"/>` +
    `<circle cx="12" cy="12" r="1.5" fill="currentColor"/>`
  )
}

/** A clock face with a varying hand angle — a time/date motif. */
const clockFace: Mark = (r) => {
  const angle = r() * 360
  const [hx, hy] = pt(12, 12, 4.4, angle)
  const [mx, my] = pt(12, 12, 6.6, angle + 110)
  return (
    `<circle cx="12" cy="12" r="8.2" stroke="currentColor" stroke-width="1.6" fill="none"/>` +
    `<path d="M12 12 L${hx} ${hy}" stroke="currentColor" stroke-width="1.8"/>` +
    `<path d="M12 12 L${mx} ${my}" stroke="currentColor" stroke-width="1.5"/>`
  )
}

/** A hexagonal cell with a nucleus — a hashing/crypto motif. */
const hexCell: Mark = (r) => {
  const size = 8 + r() * 1.4
  const rotation = r() * 30
  const parts = [polygon(12, 12, size, 6, rotation)]
  if (r() > 0.4) parts.push(polygon(12, 12, round(size * 0.46), 6, rotation, true))
  else parts.push(`<circle cx="12" cy="12" r="1.7" fill="currentColor"/>`)
  return parts.join('')
}

/** A padlock, optionally open — a security motif. */
const padlock: Mark = (r) => {
  const width = 8 + r() * 1.6
  const height = 6.4 + r() * 1.4
  const x = round(12 - width / 2)
  const y = round(20 - height)
  const lx = round(x + width * 0.22)
  const rx = round(x + width * 0.78)
  const radius = round(width * 0.28)
  const shackle =
    r() > 0.6
      ? `<path d="M${lx} ${y} V${round(y - 3)} A${radius} ${radius} 0 0 1 ${rx} ${round(y - 5)}" stroke="currentColor" stroke-width="1.7" fill="none"/>`
      : `<path d="M${lx} ${y} V${round(y - 2.4)} A${radius} ${radius} 0 0 1 ${rx} ${round(y - 2.4)} V${y}" stroke="currentColor" stroke-width="1.7" fill="none"/>`
  return (
    `<rect x="${x}" y="${y}" width="${round(width)}" height="${round(height)}" rx="1.8" stroke="currentColor" stroke-width="1.7" fill="none"/>` +
    shackle +
    `<circle cx="12" cy="${round(y + height * 0.42)}" r="1.1" fill="currentColor"/>`
  )
}

/** A key with a varying bit — a security motif. */
const keyMark: Mark = (r) => {
  const bow = 4 + r() * 1
  const parts = [
    `<circle cx="8" cy="15.6" r="${round(bow)}" stroke="currentColor" stroke-width="1.7" fill="none"/>`,
    `<path d="M11 12.6 L19.4 4.6" stroke="currentColor" stroke-width="1.7"/>`,
  ]
  parts.push(r() > 0.5 ? `<path d="M16.6 7.4 L18.6 9.4" stroke="currentColor" stroke-width="1.7"/>` : `<path d="M15.2 6 L17.2 8" stroke="currentColor" stroke-width="1.7"/>`)
  return parts.join('')
}

/** A shield outline — a security motif. */
const shieldMark: Mark = (r) => {
  const wide = 7 + r() * 1
  const parts = [
    `<path d="M12 4 5.6 6.4v5c0 ${round(3.6 + r())} 2.7 7.2 6.4 8.6 3.7-1.4 6.4-5 6.4-8.6v-5z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/>`,
  ]
  if (r() > 0.4) parts.push(`<path d="M${round(12 - wide * 0.6)} 12 L12 ${round(12 + wide * 0.4)} L${round(12 + wide * 0.7)} ${round(12 - wide * 0.5)}" stroke="currentColor" stroke-width="1.6" fill="none"/>`)
  return parts.join('')
}

/** A cloud outline — a web/network motif. */
const cloud: Mark = (r) => {
  const s = 0.85 + r() * 0.25
  const a = round(6.2 * s)
  const b = round(4.2 * s)
  const cy = round(12.5 + (1 - s) * 2)
  const d =
    `M${12 - a} ${cy + b} ` +
    `A${round(3.4 * s)} ${round(3.4 * s)} 0 0 1 ${round(12 - a + 1)} ${round(cy - b)} ` +
    `A${round(4.6 * s)} ${round(4.6 * s)} 0 0 1 ${round(12 + 2)} ${round(cy - b - 0.6)} ` +
    `A${round(3.8 * s)} ${round(3.8 * s)} 0 0 1 ${12 + a} ${round(cy + b - 1)} ` +
    `A${round(2.6 * s)} ${round(2.6 * s)} 0 0 1 ${12 - a} ${cy + b} Z`
  const parts = [`<path d="${d}" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>`]
  if (r() > 0.5) parts.push(`<path d="M8 ${round(cy + b + 3.6)} H16" stroke="currentColor" stroke-width="1.6"/>`)
  return parts.join('')
}

/** A globe with a varying meridian — a web motif. */
const globeMark: Mark = (r) => {
  const parts = [
    `<circle cx="12" cy="12" r="${round(7.6 + r() * 0.8)}" stroke="currentColor" stroke-width="1.6" fill="none"/>`,
    `<path d="M4.4 12 H19.6" stroke="currentColor" stroke-width="1.5"/>`,
  ]
  parts.push(
    r() > 0.5
      ? `<path d="M12 4.4 C15 8 15 16 12 19.6" stroke="currentColor" stroke-width="1.5" fill="none"/>`
      : `<ellipse cx="12" cy="12" rx="3.4" ry="7.6" stroke="currentColor" stroke-width="1.5" fill="none"/>`,
  )
  return parts.join('')
}

/** A winding pair of arrows — a conversion/swap motif. */
const exchange: Mark = (r) => {
  const gap = 3.8 + r() * 1.8
  const inset = 4 + r() * 1.6
  const depth = 3.6 + r() * 1.4
  const stagger = (r() - 0.5) * 2
  const top = `<path d="M${round(inset - 0.4)} ${round(12 - gap)} H${round(20 - inset + 3)}" stroke="currentColor" stroke-width="1.7"/><path d="M${round(19 - inset)} ${round(12 - gap - depth)} L${round(20 - inset + 3)} ${round(12 - gap)} L${round(19 - inset)} ${round(12 - gap + depth)}" stroke="currentColor" stroke-width="1.7" fill="none"/>`
  const bottom = `<path d="M${round(20 - inset + 3)} ${round(12 + gap + stagger)} H${round(inset - 0.4)}" stroke="currentColor" stroke-width="1.7"/><path d="M${round(inset + 1)} ${round(12 + gap + stagger - depth)} L${round(inset - 0.4)} ${round(12 + gap + stagger)} L${round(inset + 1)} ${round(12 + gap + stagger + depth)}" stroke="currentColor" stroke-width="1.7" fill="none"/>`
  return top + bottom
}

/** A framed picture with a horizon and sun — a media motif. */
const picture: Mark = (r) => {
  const w = 14.4 + r() * 1.6
  const h = 12.4 + r() * 1.6
  const x = round(12 - w / 2)
  const y = round(12 - h / 2)
  const parts = [
    `<rect x="${x}" y="${y}" width="${round(w)}" height="${round(h)}" rx="2" stroke="currentColor" stroke-width="1.6" fill="none"/>`,
  ]
  const base = round(y + h - 3.4)
  parts.push(
    r() > 0.5
      ? `<path d="M${x} ${base} L${round(x + w * 0.34)} ${round(base - 4.6)} L${round(x + w * 0.58)} ${round(base - 1.6)} L${round(x + w * 0.76)} ${round(base - 3.8)} L${round(x + w)} ${base}" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>`
      : `<path d="M${x} ${round(base + 1)} L${round(x + w * 0.28)} ${round(base - 3.4)} L${round(x + w * 0.46)} ${round(base - 0.6)} L${round(x + w * 0.68)} ${round(base - 4)} L${round(x + w)} ${base}" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>`,
  )
  if (r() > 0.4) parts.push(`<circle cx="${round(x + w * 0.72)}" cy="${round(y + h * 0.3)}" r="${round(1.4 + r() * 0.6)}" fill="currentColor"/>`)
  return parts.join('')
}

/** A swatch behind a solid chip — a colour/print motif. */
const chipsStack: Mark = (r) => {
  const front = 8 + r() * 1.6
  const f = round(12 - front / 2)
  const parts: string[] = []
  if (r() > 0.5) parts.push(`<rect x="${round(f - 3)}" y="${round(f - 3)}" width="${round(front)}" height="${round(front)}" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/>`)
  parts.push(`<rect x="${f}" y="${f}" width="${round(front)}" height="${round(front)}" rx="2" fill="currentColor"/>`)
  return parts.join('')
}

/** A paint blob with highlight dots — a design motif. */
const paletteMark: Mark = (r) => {
  const holes = 2 + Math.floor(r() * 2)
  const parts = [
    `<path d="M12 4.2a7.8 7.8 0 0 0 0 15.6c1.4 0 2-1 2-1.9 0-.9-.7-1.7-.3-2.5.4-.9 1.5-.6 2.5-.6a3.7 3.7 0 0 0 3.5-3.7C19.7 7 16.3 4.2 12 4.2Z" stroke="currentColor" stroke-width="1.6" fill="none"/>`,
  ]
  const spots: [number, number][] = [
    [8, 11.4],
    [9.6, 8.6],
    [13.4, 8.2],
  ]
  for (let i = 0; i < holes; i += 1) parts.push(`<circle cx="${spots[i][0]}" cy="${spots[i][1]}" r="1" fill="currentColor"/>`)
  return parts.join('')
}

/** A single outlined or filled polygon, rotated — a design motif. */
const polygonMark: Mark = (r) => polygon(12, 12, round(7.4 + r()), 5 + Math.floor(r() * 3), r() * 40, r() > 0.6)

/* --- Category pools --------------------------------------------------------
   Each category maps to the mark families that read as "that kind of tool".
   The slug's RNG picks one family *inside* the pool, so shapes are on-topic
   rather than random. Each pool holds at least six so one category's cards
   rarely repeat a family. Web reuses a couple of generic families on purpose:
   a globe, cloud or node graph all read as the web, and the variety is worth
   the occasional overlap with another pool (a slug only ever draws from its
   own pool, so two categories can never produce the same set). */
const POOLS: Record<string, Mark[]> = {
  Data: [gridCell, docLines, blocks, wave, brackets, ladder, chipsStack, dial],
  Text: [docLines, typeMark, wave, ladder, bars, brackets, chevrons, spiral, exchange],
  Numbers: [dial, bars, gridCell, ladder, clockFace, burst, blocks],
  Security: [padlock, hexCell, keyMark, shieldMark, ringBeads, arcs],
  Web: [cloud, globeMark, nodes, exchange, brackets, ladder, wave],
  Code: [brackets, chevrons, nodes, ladder, hexCell, blocks, spiral, gridCell],
  Media: [picture, bars, wave, arcs, chipsStack, burst, ringBeads],
  Design: [chipsStack, paletteMark, picture, blocks, polygonMark, ringBeads, burst],
}

const FALLBACK_POOL: Mark[] = [blocks, arcs, bars, ladder, ringBeads, nodes, chevrons, burst, spiral, wave, brackets, gridCell]

/** Every family above, exported so the set can be enumerated in tests. */
export const MARK_FAMILIES: Mark[] = [
  arcs, bars, ladder, ringBeads, nodes, chevrons, burst, blocks, spiral, wave,
  docLines, brackets, gridCell, typeMark, dial, clockFace, hexCell, padlock,
  keyMark, shieldMark, cloud, globeMark, exchange, picture, chipsStack,
  paletteMark, polygonMark,
]

/**
 * The inner SVG for a slug: a category-appropriate mark family plus its seeded
 * parameters. Pure and exported so the mark set can be tested without a DOM.
 *
 * The category picks the pool; the slug's PRNG picks a family inside it and
 * then varies the family's parameters, so two tools in one category diverge in
 * both shape and detail. An unknown or omitted category falls back to the
 * mixed pool, which keeps a tool added ahead of its category from breaking.
 */
export function toolMarkSvg(slug: string, category = ''): string {
  const r = rng(hash(slug))
  const pool = POOLS[category] ?? FALLBACK_POOL
  return pool[Math.floor(r() * pool.length)](r)
}

/** A square badge holding the tool's mark, tinted with its category hue. */
export function sigilTile(slug: string, category: string, size = 34): HTMLElement {
  const svg =
    `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${toolMarkSvg(slug, category)}</svg>`
  return el('span', {
    class: 'ts-sigil',
    'aria-hidden': 'true',
    style: `--h:${categoryHue(category)};width:${size}px;height:${size}px`,
    innerHTML: svg,
  })
}
