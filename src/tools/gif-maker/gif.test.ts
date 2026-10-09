import { describe, expect, it } from 'vitest'
import {
  encodeGif,
  flattenTransparency,
  frameDelay,
  lzwEncode,
  medianCut,
  planFrames,
  quantize,
  type Rgb,
} from './gif'

/**
 * An independent GIF reader, written from the spec rather than from the
 * encoder, so a round-trip here actually proves the bytes are a GIF.
 */
function decodeGif(bytes: Uint8Array) {
  let at = 0
  const u8 = () => bytes[at++]
  const u16 = () => {
    const value = bytes[at] | (bytes[at + 1] << 8)
    at += 2
    return value
  }
  const read = (n: number) => {
    const slice = bytes.subarray(at, at + n)
    at += n
    return slice
  }
  const signature = String.fromCharCode(...read(6))
  const width = u16()
  const height = u16()
  const flags = u8()
  u8() // background index
  u8() // aspect ratio
  const tableSize = 1 << ((flags & 0x07) + 1)
  const palette: Rgb[] = []
  for (let i = 0; i < tableSize; i += 1) palette.push({ r: u8(), g: u8(), b: u8() })

  const frames: { indices: number[]; delay: number }[] = []
  let loop: number | null = null
  let pendingDelay = 0

  const readSubBlocks = () => {
    const chunks: number[] = []
    for (;;) {
      const size = u8()
      if (size === 0) break
      for (const value of read(size)) chunks.push(value)
    }
    return chunks
  }

  for (;;) {
    const marker = u8()
    if (marker === 0x3b) break
    if (marker === 0x21) {
      const label = u8()
      if (label === 0xf9) {
        const size = u8()
        const packed = u8()
        pendingDelay = u16()
        const transparent = u8()
        for (let i = 4; i < size; i += 1) u8()
        u8() // block terminator
        void packed
        void transparent
      } else if (label === 0xff) {
        const size = u8()
        const name = String.fromCharCode(...read(size))
        const data = readSubBlocks()
        if (name.startsWith('NETSCAPE') && data[0] === 1) loop = data[1] | (data[2] << 8)
      } else {
        if (label === 0x01) {
          const size = u8()
          read(size)
        }
        readSubBlocks()
      }
      continue
    }
    if (marker !== 0x2c) throw new Error(`unexpected block 0x${marker.toString(16)}`)
    const fx = u16()
    const fy = u16()
    const fw = u16()
    const fh = u16()
    const localFlags = u8()
    if (localFlags & 0x80) {
      const localSize = 1 << ((localFlags & 0x07) + 1)
      for (let i = 0; i < localSize * 3; i += 1) u8()
    }
    const minCode = u8()
    const data = readSubBlocks()
    const indices = lzwDecode(data, minCode, fw * fh)
    void fx
    void fy
    frames.push({ indices, delay: pendingDelay })
  }

  return { signature, width, height, palette, frames, loop }
}

/** The mirror of the encoder's LZW, again written from the spec. */
function lzwDecode(data: number[], minCode: number, pixelCount: number): number[] {
  const clearCode = 1 << minCode
  const endCode = clearCode + 1
  let codeSize = minCode + 1
  let dictionary: number[][] = []
  const reset = () => {
    dictionary = []
    for (let i = 0; i < clearCode; i += 1) dictionary.push([i])
    dictionary.push([]) // clear
    dictionary.push([]) // end
    codeSize = minCode + 1
  }
  reset()

  const out: number[] = []
  let bitBuffer = 0
  let buffered = 0
  let previous: number[] | null = null
  let at = 0

  const nextCode = () => {
    while (buffered < codeSize) {
      if (at >= data.length) return -1
      bitBuffer |= data[at++] << buffered
      buffered += 8
    }
    const code = bitBuffer & ((1 << codeSize) - 1)
    bitBuffer >>= codeSize
    buffered -= codeSize
    return code
  }

  for (;;) {
    const code = nextCode()
    if (code < 0 || code === endCode) break
    if (code === clearCode) {
      reset()
      previous = null
      continue
    }
    let entry: number[]
    if (code < dictionary.length) entry = dictionary[code]
    else if (previous) entry = [...previous, previous[0]]
    else throw new Error('bad code')
    out.push(...entry)
    if (previous) {
      dictionary.push([...previous, entry[0]])
      if (dictionary.length === 1 << codeSize && codeSize < 12) codeSize += 1
    }
    previous = entry
  }
  if (out.length < pixelCount) throw new Error(`decoded ${out.length} of ${pixelCount} pixels`)
  return out.slice(0, pixelCount)
}

/** A deterministic two-tone frame: left column red, right column blue. */
function twoTone(width: number, height: number, delay: number) {
  const indices = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) indices[y * width + x] = x < width / 2 ? 0 : 1
  return { indices, delay }
}

describe('lzwEncode', () => {
  it('matches a hand-computed stream', () => {
    // clear(4) + 0 + end(5), three bits each, packed little-endian.
    expect(Array.from(lzwEncode([0], 2))).toEqual([0x44, 0x01])
  })
})

describe('encodeGif', () => {
  it('writes a GIF89a header and screen descriptor', () => {
    const bytes = encodeGif([twoTone(2, 2, 10)], {
      width: 2,
      height: 2,
      palette: [
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 0, b: 255 },
      ],
    })
    expect(String.fromCharCode(...bytes.subarray(0, 6))).toBe('GIF89a')
    expect(bytes[6] | (bytes[7] << 8)).toBe(2)
    expect(bytes[8] | (bytes[9] << 8)).toBe(2)
    // Global colour table present, two entries.
    expect(bytes[10] & 0x80).toBe(0x80)
  })

  it('round-trips pixels through an independent decoder', () => {
    const width = 8
    const height = 4
    const palette: Rgb[] = [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 0, b: 255 },
      { r: 0, g: 255, b: 0 },
    ]
    const indices = new Uint8Array(width * height)
    for (let i = 0; i < indices.length; i += 1) indices[i] = i % 3
    const bytes = encodeGif([{ indices, delay: 7 }], { width, height, palette })

    const decoded = decodeGif(bytes)
    expect(decoded.signature).toBe('GIF89a')
    expect(decoded.width).toBe(width)
    expect(decoded.height).toBe(height)
    expect(decoded.frames).toHaveLength(1)
    expect(decoded.frames[0].delay).toBe(7)
    expect(Array.from(decoded.frames[0].indices)).toEqual(Array.from(indices))
    expect(decoded.palette.slice(0, 3)).toEqual(palette)
  })

  it('keeps every frame of a multi-frame animation, in order', () => {
    const width = 3
    const height = 3
    const palette: Rgb[] = [
      { r: 10, g: 10, b: 10 },
      { r: 200, g: 200, b: 200 },
    ]
    const frames = [0, 1, 2].map((step) => ({
      indices: new Uint8Array(width * height).fill(step % 2),
      delay: 5 + step,
    }))
    const decoded = decodeGif(encodeGif(frames, { width, height, palette, loop: 0 }))
    expect(decoded.frames.map((frame) => frame.delay)).toEqual([5, 6, 7])
    expect(decoded.frames.map((frame) => frame.indices[0])).toEqual([0, 1, 0])
  })

  it('writes a NETSCAPE loop block for a looping animation', () => {
    const palette: Rgb[] = [
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    ]
    const looping = decodeGif(encodeGif([twoTone(2, 2, 4)], { width: 2, height: 2, palette, loop: 0 }))
    expect(looping.loop).toBe(0)
    const once = decodeGif(encodeGif([twoTone(2, 2, 4)], { width: 2, height: 2, palette }))
    expect(once.loop).toBeNull()
  })

  it('pads the colour table to a power of two', () => {
    const palette: Rgb[] = [
      { r: 1, g: 2, b: 3 },
      { r: 4, g: 5, b: 6 },
      { r: 7, g: 8, b: 9 },
    ]
    const bytes = encodeGif([twoTone(2, 2, 1)], { width: 2, height: 2, palette })
    // Three colours still need a four-entry table.
    expect(1 << ((bytes[10] & 0x07) + 1)).toBe(4)
    // The fourth entry is a copy of the third, not a hole.
    expect(Array.from(bytes.subarray(22, 25))).toEqual([7, 8, 9])
  })

  it('rejects malformed input instead of writing a broken file', () => {
    expect(() => encodeGif([], { width: 2, height: 2, palette: [{ r: 0, g: 0, b: 0 }] })).toThrow(/at least one frame/)
    expect(() => encodeGif([twoTone(2, 2, 1)], { width: 0, height: 2, palette: [{ r: 0, g: 0, b: 0 }] })).toThrow(/positive size/)
    expect(() => encodeGif([twoTone(2, 2, 1)], { width: 2, height: 2, palette: [] })).toThrow(/1 to 256/)
    expect(() =>
      encodeGif([{ indices: new Uint8Array(3), delay: 1 }], { width: 2, height: 2, palette: [{ r: 0, g: 0, b: 0 }] }),
    ).toThrow(/match the GIF size/)
    expect(() =>
      encodeGif([{ indices: new Uint8Array([0, 9, 0, 0]), delay: 1 }], {
        width: 2,
        height: 2,
        palette: [
          { r: 0, g: 0, b: 0 },
          { r: 1, g: 1, b: 1 },
        ],
      }),
    ).toThrow(/outside the palette/)
  })

  it('survives a long run that overflows the dictionary', () => {
    const width = 128
    const height = 128
    const palette: Rgb[] = [
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    ]
    // Random-ish noise maximises distinct substrings and forces code-size churn.
    const indices = new Uint8Array(width * height)
    let seed = 7
    for (let i = 0; i < indices.length; i += 1) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      indices[i] = (seed >> 16) & 1
    }
    const decoded = decodeGif(encodeGif([{ indices, delay: 3 }], { width, height, palette }))
    expect(Array.from(decoded.frames[0].indices)).toEqual(Array.from(indices))
  })
})

describe('medianCut', () => {
  const histogramOf = (colors: { rgb: Rgb; count: number }[]) =>
    new Map(colors.map(({ rgb, count }) => [(rgb.r << 16) | (rgb.g << 8) | rgb.b, count]))

  it('keeps the colours that are actually present', () => {
    const histogram = histogramOf([
      { rgb: { r: 255, g: 0, b: 0 }, count: 1000 },
      { rgb: { r: 0, g: 0, b: 255 }, count: 1000 },
    ])
    const palette = medianCut(histogram, 2)
    expect(palette).toContainEqual({ r: 255, g: 0, b: 0 })
    expect(palette).toContainEqual({ r: 0, g: 0, b: 255 })
  })

  it('never returns more entries than asked for', () => {
    const histogram = histogramOf(
      Array.from({ length: 40 }, (_, i) => ({ rgb: { r: i * 6, g: 255 - i * 6, b: i * 3 }, count: 10 + i })),
    )
    expect(medianCut(histogram, 8)).toHaveLength(8)
  })

  it('falls back to black for an empty histogram', () => {
    expect(medianCut(new Map(), 16)).toEqual([{ r: 0, g: 0, b: 0 }])
  })
})

describe('flattenTransparency', () => {
  it('blends partial alpha onto the matte and snaps opaque/clear', () => {
    const out = flattenTransparency(
      new Uint8ClampedArray([
        255, 0, 0, 128, // half red over black
        255, 0, 0, 255, // fully opaque
        255, 0, 0, 0, // fully clear
      ]),
      { r: 0, g: 0, b: 0 },
    )
    expect(out[0]).toBe(128)
    expect(out[3]).toBe(255)
    expect(out[4]).toBe(255)
    expect(out[7]).toBe(255)
    // Clear pixels keep the matte colour so the quantiser cannot pick an edge hue.
    expect(out[8]).toBe(0)
    expect(out[11]).toBe(0)
  })

  it('honours a lower transparency threshold', () => {
    const out = flattenTransparency(new Uint8ClampedArray([10, 20, 30, 100]), { r: 0, g: 0, b: 0 }, 50)
    expect(out[3]).toBe(255)
  })
})

describe('quantize', () => {
  const palette: Rgb[] = [
    { r: 0, g: 0, b: 0 },
    { r: 255, g: 255, b: 255 },
  ]

  it('snaps each pixel to the nearest entry when dithering is off', () => {
    const rgba = new Uint8ClampedArray([
      250, 250, 250, 255, // near white
      5, 5, 5, 255, // near black
    ])
    expect(Array.from(quantize(rgba, palette, 2, 1, false))).toEqual([1, 0])
  })

  it('keeps dithering within the palette and preserves frame size', () => {
    const width = 6
    const height = 4
    const rgba = new Uint8ClampedArray(width * height * 4)
    for (let p = 0; p < width * height; p += 1) {
      // A smooth ramp that both entries bracket, so error is always non-zero.
      rgba[p * 4] = rgba[p * 4 + 1] = rgba[p * 4 + 2] = (p * 255) / (width * height)
      rgba[p * 4 + 3] = 255
    }
    const indices = quantize(rgba, palette, width, height, true)
    expect(indices).toHaveLength(width * height)
    expect([...indices].every((index) => index < palette.length)).toBe(true)
    // A ramp dithered between two levels must use both of them.
    expect(new Set(indices).size).toBe(2)
  })

  it('never diffuses error into transparent neighbours', () => {
    const rgba = new Uint8ClampedArray([
      255, 255, 255, 255,
      0, 0, 0, 0, // transparent, must stay pinned to index 0
      255, 255, 255, 255,
      255, 255, 255, 255,
    ])
    const indices = quantize(rgba, palette, 2, 2, true)
    expect(indices[1]).toBe(0)
  })
})

describe('timing helpers', () => {
  it('turns a frame rate into hundredths of a second', () => {
    expect(frameDelay(10)).toBe(10)
    expect(frameDelay(25)).toBe(4)
    expect(frameDelay(0)).toBe(10)
    expect(frameDelay(1000)).toBe(1)
  })

  it('counts the frames a range selection implies', () => {
    expect(planFrames(30, 0, 29, 1)).toBe(30)
    expect(planFrames(30, 0, 29, 2)).toBe(15)
    expect(planFrames(30, 5, 14, 3)).toBe(4)
    expect(planFrames(30, 20, 5, 1)).toBe(1)
    expect(planFrames(0, 0, 0, 1)).toBe(0)
  })
})
