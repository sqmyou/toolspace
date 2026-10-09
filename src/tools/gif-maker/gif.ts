/**
 * A small GIF89a encoder and the pure logic behind the GIF Maker.
 *
 * Frames arrive already quantised: the encoder is handed indexed pixels plus
 * a palette, which keeps it honest and testable — no canvas, no DOM, no
 * globals. The UI does the sampling and colour reduction.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

export interface IndexedFrame {
  /** One palette index per pixel, row-major, `width * height` long. */
  indices: Uint8Array
  /** Delay before the next frame, in hundredths of a second. */
  delay: number
}

export interface GifOptions {
  width: number
  height: number
  /** GIF palette. */
  palette: Rgb[]
  /**
   * NETSCAPE loop count. `0` loops forever, a positive number loops that many
   * times. Omit the field entirely to play the animation once.
   */
  loop?: number
}

const BYTE_MAX = 255

function clampByte(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(BYTE_MAX, Math.round(value)))
}

/**
 * Median cut.
 *
 * A histogram is repeatedly split along its widest channel until it holds
 * `maxColors` boxes; each box's average becomes a palette entry. It is the
 * classic GIF/PNG quantiser and, unlike a uniform grid in RGB space, it spends
 * colours where the image actually has them.
 *
 * The histogram is a sparse `Map` of packed 8-bit `0xRRGGBB` keys, so a photo
 * costs a few thousand entries rather than a flat 16-million-cell array.
 */
export function medianCut(counts: Map<number, number>, maxColors = 256): Rgb[] {
  if (counts.size === 0) return [{ r: 0, g: 0, b: 0 }]

  const channel = (key: number, shift: number) => (key >> shift) & 0xff
  const boxOf = (keys: number[]) => {
    const first = keys[0]
    return {
      keys,
      min: [channel(first, 16), channel(first, 8), channel(first, 0)],
      max: [channel(first, 16), channel(first, 8), channel(first, 0)],
      count: 0,
    }
  }
  const measure = (box: ReturnType<typeof boxOf>) => {
    box.min = [BYTE_MAX, BYTE_MAX, BYTE_MAX]
    box.max = [0, 0, 0]
    box.count = 0
    for (const key of box.keys) {
      for (let c = 0; c < 3; c += 1) {
        const value = channel(key, (2 - c) * 8)
        if (value < box.min[c]) box.min[c] = value
        if (value > box.max[c]) box.max[c] = value
      }
      box.count += counts.get(key) ?? 0
    }
  }
  const widest = (box: ReturnType<typeof boxOf>) => {
    const spans = [box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]]
    return spans.indexOf(Math.max(...spans))
  }

  const boxes = [boxOf([...counts.keys()])]
  measure(boxes[0])

  while (boxes.length < maxColors) {
    let target = -1
    let best = -1
    for (let i = 0; i < boxes.length; i += 1) {
      const box = boxes[i]
      if (box.keys.length < 2) continue
      const span = Math.max(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2])
      // Weight by population so a large, flat region is not left aliased.
      const score = span * Math.log2(box.count + 1)
      if (score > best) {
        best = score
        target = i
      }
    }
    if (target < 0) break

    const box = boxes[target]
    const shift = (2 - widest(box)) * 8
    box.keys.sort((a, b) => channel(a, shift) - channel(b, shift))

    let half = 0
    let split = 1
    for (; split < box.keys.length; split += 1) {
      half += counts.get(box.keys[split - 1]) ?? 0
      if (half * 2 >= box.count) break
    }
    if (split >= box.keys.length) split = box.keys.length - 1

    const left = boxOf(box.keys.slice(0, split))
    const right = boxOf(box.keys.slice(split))
    measure(left)
    measure(right)
    boxes.splice(target, 1, left, right)
  }

  const palette = boxes.map((box) => {
    let weigh = 0
    let r = 0
    let g = 0
    let b = 0
    for (const key of box.keys) {
      const count = counts.get(key) ?? 0
      r += channel(key, 16) * count
      g += channel(key, 8) * count
      b += channel(key, 0) * count
      weigh += count
    }
    if (!weigh) return { r: 0, g: 0, b: 0 }
    return { r: Math.round(r / weigh), g: Math.round(g / weigh), b: Math.round(b / weigh) }
  })

  while (palette.length < maxColors && palette.length < 256) palette.push({ ...palette[palette.length - 1] })
  return palette.slice(0, maxColors)
}

/**
 * Composite partially transparent pixels onto a matte and snap the rest fully
 * opaque. GIF has no partial alpha, so an unflattened edge quantises to a
 * visible dark fringe; blending first is what stops it.
 */
export function flattenTransparency(rgba: Uint8ClampedArray, matte: Rgb, threshold = 128): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba.length)
  out.set(rgba)
  for (let p = 0; p < rgba.length; p += 4) {
    const alpha = rgba[p + 3] / BYTE_MAX
    if (alpha >= 1) continue
    out[p] = Math.round(rgba[p] * alpha + matte.r * (1 - alpha))
    out[p + 1] = Math.round(rgba[p + 1] * alpha + matte.g * (1 - alpha))
    out[p + 2] = Math.round(rgba[p + 2] * alpha + matte.b * (1 - alpha))
    out[p + 3] = alpha * BYTE_MAX >= threshold ? BYTE_MAX : 0
  }
  return out
}

/** Find the closest palette entry by squared distance. */
function nearest(palette: Rgb[], r: number, g: number, b: number): number {
  let best = 0
  let bestDistance = Infinity
  for (let i = 0; i < palette.length; i += 1) {
    const entry = palette[i]
    const dr = entry.r - r
    const dg = entry.g - g
    const db = entry.b - b
    const distance = dr * dr + dg * dg + db * db
    if (distance < bestDistance) {
      bestDistance = distance
      best = i
    }
  }
  return best
}

/**
 * The nearest palette index for every pixel, with Floyd–Steinberg error
 * diffusion when `dither` is on.
 *
 * A 256-colour GIF of a photographic frame bands badly without dithering; the
 * error from each pixel is pushed onto its unprocessed neighbours so the eye
 * averages it back. Alpha is carried along the *un*-diffused channel, so the
 * error pushed to a transparent neighbour never resurrects it.
 */
export function quantize(
  rgba: Uint8ClampedArray,
  palette: Rgb[],
  width: number,
  height: number,
  dither = false,
): Uint8Array {
  const indices = new Uint8Array(width * height)
  if (!dither) {
    for (let p = 0; p < indices.length; p += 1) {
      const offset = p * 4
      indices[p] = nearest(palette, rgba[offset], rgba[offset + 1], rgba[offset + 2])
    }
    return indices
  }

  const color = Float32Array.from(rgba)
  const alpha = new Uint8ClampedArray(indices.length)
  for (let p = 0; p < indices.length; p += 1) alpha[p] = rgba[p * 4 + 3]

  const spread = (p: number, dr: number, dg: number, db: number, factor: number) => {
    if (alpha[p] === 0) return
    const offset = p * 4
    color[offset] += dr * factor
    color[offset + 1] += dg * factor
    color[offset + 2] += db * factor
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x
      const offset = p * 4
      const r = color[offset]
      const g = color[offset + 1]
      const b = color[offset + 2]
      const index = nearest(palette, r, g, b)
      indices[p] = index
      const entry = palette[index]
      const dr = r - entry.r
      const dg = g - entry.g
      const db = b - entry.b
      if (x + 1 < width) spread(p + 1, dr, dg, db, 7 / 16)
      if (y + 1 < height) {
        if (x > 0) spread(p + width - 1, dr, dg, db, 3 / 16)
        spread(p + width, dr, dg, db, 5 / 16)
        if (x + 1 < width) spread(p + width + 1, dr, dg, db, 1 / 16)
      }
    }
  }
  return indices
}

class ByteWriter {
  private bytes: number[] = []

  byte(value: number): void {
    this.bytes.push(clampByte(value))
  }

  /** Little-endian, as GIF requires. */
  short(value: number): void {
    this.byte(value & 0xff)
    this.byte((value >> 8) & 0xff)
  }

  ascii(text: string): void {
    for (const char of text) this.byte(char.charCodeAt(0))
  }

  raw(values: ArrayLike<number>): void {
    for (let i = 0; i < values.length; i += 1) this.byte(values[i])
  }

  finish(): Uint8Array {
    return Uint8Array.from(this.bytes)
  }
}

/** GIF wants the colour table in powers of two, at least two entries. */
function paletteBits(count: number): number {
  let bits = 1
  while (1 << bits < count) bits += 1
  return Math.max(1, bits)
}

/**
 * Assemble a looping GIF89a. Frames must all be `width * height` pixels.
 *
 * An index outside the palette is rejected rather than masked, because the
 * alternative is a silently wrong picture.
 */
export function encodeGif(frames: IndexedFrame[], options: GifOptions): Uint8Array {
  const { width, height, palette } = options
  if (frames.length === 0) throw new Error('A GIF needs at least one frame.')
  if (width < 1 || height < 1) throw new Error('A GIF needs a positive size.')
  if (palette.length === 0 || palette.length > 256) throw new Error('A GIF palette holds 1 to 256 colours.')

  const pixels = width * height
  for (const frame of frames) {
    if (frame.indices.length !== pixels) throw new Error('A frame does not match the GIF size.')
    for (let i = 0; i < pixels; i += 1) {
      if (frame.indices[i] >= palette.length) throw new Error('A frame references a colour outside the palette.')
    }
  }

  const bits = paletteBits(palette.length)
  const tableSize = 1 << bits
  const writer = new ByteWriter()

  writer.ascii('GIF89a')
  writer.short(width)
  writer.short(height)
  // Global colour table present, colour resolution 8, `bits` per entry.
  writer.byte(0x80 | (0x7 << 4) | (bits - 1))
  writer.byte(0) // background colour index
  writer.byte(0) // default pixel aspect ratio

  for (let i = 0; i < tableSize; i += 1) {
    const entry = palette[i] ?? palette[palette.length - 1]
    writer.byte(entry.r)
    writer.byte(entry.g)
    writer.byte(entry.b)
  }

  if (options.loop !== undefined) {
    writer.byte(0x21)
    writer.byte(0xff)
    writer.byte(11)
    writer.ascii('NETSCAPE2.0')
    writer.byte(3)
    writer.byte(1)
    writer.short(Math.max(0, Math.min(options.loop, 0xffff)))
    writer.byte(0)
  }

  for (const frame of frames) {
    writer.byte(0x21)
    writer.byte(0xf9)
    writer.byte(4)
    writer.byte(0) // no transparency in the shared-table path
    writer.short(Math.max(0, Math.min(frame.delay, 0xffff)))
    writer.byte(0) // transparent colour index (unused)
    writer.byte(0)

    writer.byte(0x2c)
    writer.short(0)
    writer.short(0)
    writer.short(width)
    writer.short(height)
    writer.byte(0) // no local colour table, not interlaced

    const minCode = Math.max(2, bits)
    writer.byte(minCode)
    const lzw = lzwEncode(frame.indices, minCode)
    for (let offset = 0; offset < lzw.length; offset += 255) {
      const chunk = lzw.subarray(offset, offset + 255)
      writer.byte(chunk.length)
      writer.raw(chunk)
    }
    writer.byte(0)
  }

  writer.byte(0x3b)
  return writer.finish()
}

/**
 * GIF's variable-width LZW. Codes start at `minCode + 1` bits and widen as the
 * dictionary fills; `clear` and `end` are reserved, so the table stops at 4096.
 */
export function lzwEncode(indices: ArrayLike<number>, minCode: number): Uint8Array {
  const clearCode = 1 << minCode
  const endCode = clearCode + 1
  let codeSize = minCode + 1
  let next = endCode + 1

  const out = new ByteWriter()
  let buffer = 0
  let buffered = 0
  const emit = (code: number) => {
    buffer |= code << buffered
    buffered += codeSize
    while (buffered >= 8) {
      out.byte(buffer & 0xff)
      buffer >>= 8
      buffered -= 8
    }
  }

  let dictionary = new Map<string, number>()
  const reset = () => {
    dictionary = new Map()
    for (let i = 0; i < clearCode; i += 1) dictionary.set(String.fromCharCode(i), i)
    next = endCode + 1
    codeSize = minCode + 1
  }

  emit(clearCode)
  reset()
  let prefix = ''
  for (let i = 0; i < indices.length; i += 1) {
    const char = String.fromCharCode(indices[i])
    const candidate = prefix + char
    if (dictionary.has(candidate)) {
      prefix = candidate
      continue
    }
    emit(dictionary.get(prefix) ?? indices[i])
    if (next < 4096) {
      dictionary.set(candidate, next)
      next += 1
      if (next - 1 === 1 << codeSize && codeSize < 12) codeSize += 1
    } else {
      emit(clearCode)
      reset()
    }
    prefix = char
  }
  if (prefix !== '') emit(dictionary.get(prefix) ?? 0)
  emit(endCode)
  if (buffered > 0) out.byte(buffer & 0xff)
  return out.finish()
}

/** Hundredths of a second per frame for a target rate. */
export function frameDelay(fps: number): number {
  if (!Number.isFinite(fps) || fps <= 0) return 10
  return Math.max(1, Math.round(100 / fps))
}

/** Frame counts a `start`/`end`/`every` selection implies, before capping. */
export function planFrames(total: number, start: number, end: number, every: number): number {
  if (total <= 0) return 0
  const step = Math.max(1, Math.floor(every))
  const from = Math.max(0, Math.min(total - 1, Math.floor(start)))
  const to = Math.max(from, Math.min(total - 1, Math.floor(end)))
  return Math.floor((to - from) / step) + 1
}
