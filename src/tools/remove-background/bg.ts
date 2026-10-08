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
 */
export function backgroundMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  background: Rgb,
  tolerance: number,
): Uint8Array {
  const mask = new Uint8Array(width * height)
  const visited = new Uint8Array(width * height)
  const threshold = (tolerance / 100) * 441.67

  const stack: number[] = []
  const seed = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    stack.push(y * width + x)
  }
  for (let x = 0; x < width; x += 1) {
    seed(x, 0)
    seed(x, height - 1)
  }
  for (let y = 0; y < height; y += 1) {
    seed(0, y)
    seed(width - 1, y)
  }

  while (stack.length > 0) {
    const index = stack.pop() as number
    if (visited[index]) continue
    visited[index] = 1

    const i = index * 4
    const pixel = { r: data[i], g: data[i + 1], b: data[i + 2] }
    if (colorDistance(pixel, background) > threshold) continue

    mask[index] = 1
    const x = index % width
    const y = (index - x) / width
    seed(x - 1, y)
    seed(x + 1, y)
    seed(x, y - 1)
    seed(x, y + 1)
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
  feather: number
  despill: number
}

/**
 * Run the whole pipeline over a copy of the pixels. Returns new data rather
 * than mutating, so the caller can re-run with different settings.
 */
export function removeBackground(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  settings: RemovalSettings,
  background?: Rgb,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(source)
  const backdrop = background ?? estimateBackground(data, width, height)
  const mask = backgroundMask(data, width, height, backdrop, settings.tolerance)
  const feathered = featherMask(mask, width, height, settings.feather)
  applyMask(data, feathered)
  despill(data, backdrop, settings.despill)
  return data
}
