/**
 * Background removal, implemented from scratch.
 *
 * There is no model to download and nothing to send away: this is a flood
 * fill from the border, which is exactly what you want for the common case of
 * a logo, screenshot, product shot or icon on a flat backdrop. Photographs
 * with busy backgrounds are out of scope and the UI says so.
 *
 * Pure maths on a pixel buffer, so it can be tested without a canvas.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

/** Euclidean distance in RGB, 0-441. */
export function colorDistance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
}

/**
 * The backdrop colour, estimated from the image border.
 *
 * A per-channel median is used rather than a mean so a stray dark object
 * touching one edge cannot drag the whole estimate off.
 */
export function estimateBackground(data: Uint8ClampedArray, width: number, height: number): Rgb {
  const reds: number[] = []
  const greens: number[] = []
  const blues: number[] = []

  const push = (x: number, y: number) => {
    const i = (y * width + x) * 4
    reds.push(data[i])
    greens.push(data[i + 1])
    blues.push(data[i + 2])
  }

  const step = Math.max(1, Math.floor(Math.min(width, height) / 200))
  for (let x = 0; x < width; x += step) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y += step) {
    push(0, y)
    push(width - 1, y)
  }

  const median = (values: number[]) => {
    values.sort((a, b) => a - b)
    return values[Math.floor(values.length / 2)]
  }

  return { r: median(reds), g: median(greens), b: median(blues) }
}

/**
 * Which pixels belong to the background: 1 for background, 0 for subject.
 *
 * Flood filled inward from every border pixel, so a region of background
 * colour *inside* the subject (a white highlight in a logo, say) is kept.
 * `tolerance` is 0-100 and scales the accepted colour distance.
 *
 * `drift` (also 0-100) adds *continuity* on top of that: an interior pixel is
 * also accepted if it is close to the background pixel it grew from, even when
 * it is far from the estimated average. That is what follows a soft studio or
 * sky gradient — which averages to something no single pixel matches — while
 * stopping dead at the sharp edge of a subject. It cannot jump across the
 * subject, because every step must stay local. At `drift` 0 this is exactly
 * the plain global flood fill.
 */
export function backgroundMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  background: Rgb,
  tolerance: number,
  drift = 0,
): Uint8Array {
  const mask = new Uint8Array(width * height)
  const visited = new Uint8Array(width * height)
  const threshold = (tolerance / 100) * 441.67
  const driftThreshold = (Math.max(0, drift) / 100) * 441.67

  // Each stack entry is [index, parentR, parentG, parentB]: the colour of the
  // accepted pixel we grew from, which is what the continuity test compares to.
  const stack: number[] = []
  const push = (x: number, y: number, pr: number, pg: number, pb: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    stack.push(y * width + x, pr, pg, pb)
  }
  const seedBorder = (x: number, y: number) => push(x, y, background.r, background.g, background.b)
  for (let x = 0; x < width; x += 1) {
    seedBorder(x, 0)
    seedBorder(x, height - 1)
  }
  for (let y = 0; y < height; y += 1) {
    seedBorder(0, y)
    seedBorder(width - 1, y)
  }

  while (stack.length > 0) {
    const parentB = stack.pop() as number
    const parentG = stack.pop() as number
    const parentR = stack.pop() as number
    const index = stack.pop() as number
    if (visited[index]) continue
    visited[index] = 1

    const i = index * 4
    const pixel = { r: data[i], g: data[i + 1], b: data[i + 2] }
    const fromBackdrop = colorDistance(pixel, background)
    const matchesBackdrop = fromBackdrop <= threshold
    const x = index % width
    const y = (index - x) / width
    const onBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1
    // A border seed must match the backdrop outright. Further in, a pixel may
    // also be accepted by continuity: the step from its parent must be small
    // *and* it must still be within `driftThreshold` of the backdrop. That
    // second bound is what stops a walk from climbing one soft edge and then
    // flooding an entire flat subject.
    const continues =
      !onBorder &&
      driftThreshold > 0 &&
      fromBackdrop <= driftThreshold &&
      colorDistance(pixel, { r: parentR, g: parentG, b: parentB }) <= driftThreshold
    if (!matchesBackdrop && !continues) continue

    mask[index] = 1
    // Grow from *this* pixel, so continuity follows a gradient one step at a
    // time rather than measuring every pixel against the flat average.
    push(x - 1, y, pixel.r, pixel.g, pixel.b)
    push(x + 1, y, pixel.r, pixel.g, pixel.b)
    push(x, y - 1, pixel.r, pixel.g, pixel.b)
    push(x, y + 1, pixel.r, pixel.g, pixel.b)
  }

  return mask
}

/**
 * Soften the mask edge so cutouts do not look like they were made with
 * scissors. A box blur is enough here and is far cheaper than a gaussian.
 */
export function featherMask(mask: Uint8Array, width: number, height: number, radius: number): Float32Array {
  if (radius <= 0) return Float32Array.from(mask)

  const blurred = new Float32Array(width * height)
  const window = radius * 2 + 1

  // Separable: horizontal pass then vertical pass.
  const horizontal = new Float32Array(width * height)
  for (let y = 0; y < height; y += 1) {
    let sum = 0
    for (let x = -radius; x <= radius; x += 1) sum += mask[y * width + clampIndex(x, width)]
    for (let x = 0; x < width; x += 1) {
      horizontal[y * width + x] = sum / window
      sum -= mask[y * width + clampIndex(x - radius, width)]
      sum += mask[y * width + clampIndex(x + radius + 1, width)]
    }
  }
  for (let x = 0; x < width; x += 1) {
    let sum = 0
    for (let y = -radius; y <= radius; y += 1) sum += horizontal[clampIndex(y, height) * width + x]
    for (let y = 0; y < height; y += 1) {
      blurred[y * width + x] = sum / window
      sum -= horizontal[clampIndex(y - radius, height) * width + x]
      sum += horizontal[clampIndex(y + radius + 1, height) * width + x]
    }
  }

  return blurred
}

function clampIndex(value: number, length: number): number {
  return Math.min(length - 1, Math.max(0, value))
}

/**
 * How far the border colour strays from its average, as a 0-100 score. A flat
 * backdrop scores near zero; a soft gradient or a textured wall scores higher.
 * Used to pick a starting `drift` so a photo does not need the slider nudged by
 * hand. The *maximum* is used, not the mean, so that a small but far-off corner
 * still pushes the score up.
 */
export function borderSpread(data: Uint8ClampedArray, width: number, height: number): number {
  const step = Math.max(1, Math.floor(Math.min(width, height) / 200))
  let count = 0
  let mean = { r: 0, g: 0, b: 0 }
  const read = (x: number, y: number) => {
    const i = (y * width + x) * 4
    return { r: data[i], g: data[i + 1], b: data[i + 2] }
  }
  const sample = (x: number, y: number) => {
    const colour = read(x, y)
    mean = { r: mean.r + colour.r, g: mean.g + colour.g, b: mean.b + colour.b }
    count += 1
    return colour
  }
  const colours: Rgb[] = []
  for (let x = 0; x < width; x += step) {
    colours.push(sample(x, 0), sample(x, height - 1))
  }
  for (let y = 0; y < height; y += step) {
    colours.push(sample(0, y), sample(width - 1, y))
  }
  if (count === 0) return 0
  mean = { r: mean.r / count, g: mean.g / count, b: mean.b / count }
  let worst = 0
  for (const colour of colours) worst = Math.max(worst, colorDistance(colour, mean))
  return Math.min(100, (worst / 441.67) * 100)
}

/**
 * Apply a mask to the alpha channel. The mask is 1 for background, so alpha
 * is inverted; `blurred` may be a feathered float mask.
 */
export function applyMask(data: Uint8ClampedArray, mask: Uint8Array | Float32Array): void {
  for (let index = 0; index < mask.length; index += 1) {
    const background = mask[index]
    const alpha = 255 * (1 - Math.min(1, Math.max(0, background)))
    const i = index * 4 + 3
    data[i] = Math.min(data[i], alpha)
  }
}

/**
 * Knock the backdrop's tint out of the subject's edges.
 *
 * Wherever the background's strongest channel dominates a pixel, that channel
 * is clamped to the highest of the others — the classic green-screen despill,
 * generalised to any flat backdrop colour.
 */
export function despill(data: Uint8ClampedArray, background: Rgb, strength: number): void {
  if (strength <= 0) return
  const channels: Array<keyof Rgb> = ['r', 'g', 'b']
  const dominant = channels.reduce((best, channel) => (background[channel] > background[best] ? channel : best), 'r')
  const offset = dominant === 'r' ? 0 : dominant === 'g' ? 1 : 2
  const others = [0, 1, 2].filter((index) => index !== offset)

  for (let i = 0; i < data.length; i += 4) {
    const value = data[i + offset]
    const ceiling = Math.max(data[i + others[0]], data[i + others[1]])
    if (value <= ceiling) continue
    data[i + offset] = value - (value - ceiling) * strength
  }
}

export interface RemovalSettings {
  tolerance: number
  /** 0-100. Continuity allowance for soft/gradient backdrops; 0 is the plain fill. */
  drift: number
  feather: number
  despill: number
}

/* ---------------------------------------------------------------------------
   Manual brush
   ------------------------------------------------------------------------- */

export interface BrushPoint {
  x: number
  y: number
}

/**
 * One painted path. `radius` is in source pixels. `erase` hides more (forces
 * the mask to "background", i.e. transparent); `restore` brings the subject
 * back (forces the mask to "subject", i.e. opaque).
 */
export interface BrushStroke {
  mode: 'erase' | 'restore'
  radius: number
  points: BrushPoint[]
}

/** Set a disc of the mask, clipped to the image. */
function stampDisc(mask: Uint8Array, width: number, height: number, cx: number, cy: number, radius: number, value: number) {
  const r = Math.max(0, radius)
  const r2 = r * r
  const x0 = Math.max(0, Math.floor(cx - r))
  const x1 = Math.min(width - 1, Math.ceil(cx + r))
  const y0 = Math.max(0, Math.floor(cy - r))
  const y1 = Math.min(height - 1, Math.ceil(cy + r))
  for (let y = y0; y <= y1; y += 1) {
    const dy = y - cy
    for (let x = x0; x <= x1; x += 1) {
      const dx = x - cx
      if (dx * dx + dy * dy <= r2) mask[y * width + x] = value
    }
  }
}

/**
 * Paint one stroke onto a mask in place. Consecutive points are joined by
 * discs spaced a fraction of the radius apart, so a fast drag leaves a solid
 * line rather than a row of dots.
 */
export function paintStroke(mask: Uint8Array, width: number, height: number, stroke: BrushStroke): void {
  // The mask holds 1 for background. Erasing paints background, restoring
  // paints subject, so the two modes set opposite values.
  const value = stroke.mode === 'erase' ? 1 : 0
  const radius = Math.max(0.5, stroke.radius)
  const points = stroke.points.length > 0 ? stroke.points : [{ x: 0, y: 0 }]
  const spacing = Math.max(1, radius / 2)

  stampDisc(mask, width, height, points[0].x, points[0].y, radius, value)
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    const distance = Math.hypot(b.x - a.x, b.y - a.y)
    const steps = Math.max(1, Math.ceil(distance / spacing))
    for (let s = 1; s <= steps; s += 1) {
      const t = s / steps
      stampDisc(mask, width, height, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, radius, value)
    }
  }
}

/* ---------------------------------------------------------------------------
   Replacement background
   ------------------------------------------------------------------------- */

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const value = Number.parseInt(full, 16)
  if (!Number.isFinite(value) || full.length !== 6) return { r: 0, g: 0, b: 0 }
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 }
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const part = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

/** A replacement backdrop: nothing, a flat colour, or a two-stop gradient. */
export type BackgroundFill =
  | { kind: 'transparent' }
  | { kind: 'solid'; color: Rgb }
  /** `angle` in degrees: 0 is left→right, 90 is top→bottom. */
  | { kind: 'linear'; from: Rgb; to: Rgb; angle: number }

/** The fill colour at a pixel, used by both the canvas and the CSS swatch. */
export function fillColorAt(fill: BackgroundFill, width: number, height: number, x: number, y: number): Rgb | null {
  if (fill.kind === 'transparent') return null
  if (fill.kind === 'solid') return fill.color

  const rad = (fill.angle * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const project = (px: number, py: number) => px * dx + py * dy
  // Corners use the last pixel index, not the dimension, so the gradient's two
  // stops land exactly on the extremes of the image rather than one pixel past.
  const w = width - 1
  const h = height - 1
  const corners = [project(0, 0), project(w, 0), project(0, h), project(w, h)]
  const min = Math.min(...corners)
  const max = Math.max(...corners)
  const span = max - min || 1
  const t = Math.min(1, Math.max(0, (project(x, y) - min) / span))
  return {
    r: fill.from.r + (fill.to.r - fill.from.r) * t,
    g: fill.from.g + (fill.to.g - fill.from.g) * t,
    b: fill.from.b + (fill.to.b - fill.from.b) * t,
  }
}

/**
 * Put a backdrop back behind the cut-out. Where the cut-out is transparent the
 * fill shows through at full strength; where it is opaque the subject wins.
 * The result is fully opaque, which is what a JPEG export needs.
 */
export function compositeBackground(data: Uint8ClampedArray, width: number, height: number, fill: BackgroundFill): void {
  if (fill.kind === 'transparent') return
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const alpha = data[i + 3] / 255
      const colour = fillColorAt(fill, width, height, x, y) as Rgb
      data[i] = colour.r * (1 - alpha) + data[i] * alpha
      data[i + 1] = colour.g * (1 - alpha) + data[i + 1] * alpha
      data[i + 2] = colour.b * (1 - alpha) + data[i + 2] * alpha
      data[i + 3] = 255
    }
  }
}

/**
 * Run the whole pipeline over a copy of the pixels. Returns new data rather
 * than mutating, so the caller can re-run with different settings. Any manual
 * brush strokes are applied on top of the automatic mask before feathering.
 */
export function removeBackground(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  settings: RemovalSettings,
  background?: Rgb,
  strokes: BrushStroke[] = [],
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(source)
  const backdrop = background ?? estimateBackground(data, width, height)
  const mask = backgroundMask(data, width, height, backdrop, settings.tolerance, settings.drift)
  for (const stroke of strokes) paintStroke(mask, width, height, stroke)
  const feathered = featherMask(mask, width, height, settings.feather)
  applyMask(data, feathered)
  despill(data, backdrop, settings.despill)
  return data
}
