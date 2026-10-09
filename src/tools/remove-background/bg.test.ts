import { describe, expect, it } from 'vitest'
import {
  applyMask,
  backgroundMask,
  borderSpread,
  colorDistance,
  compositeBackground,
  despill,
  estimateBackground,
  featherMask,
  fillColorAt,
  hexToRgb,
  paintStroke,
  removeBackground,
  rgbToHex,
} from './bg'

/** Build a pixel buffer from a row-major list of [r,g,b,a] tuples. */
function pixels(rows: number[][]): Uint8ClampedArray {
  return Uint8ClampedArray.from(rows.flat())
}

/** A width x height image where every pixel is `colour`, except a block. */
function solid(width: number, height: number, colour: [number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = colour[0]
    data[i + 1] = colour[1]
    data[i + 2] = colour[2]
    data[i + 3] = 255
  }
  return data
}

function setPixel(data: Uint8ClampedArray, width: number, x: number, y: number, colour: [number, number, number]) {
  const i = (y * width + x) * 4
  data[i] = colour[0]
  data[i + 1] = colour[1]
  data[i + 2] = colour[2]
}

describe('colorDistance', () => {
  it('is zero for identical colours', () => {
    expect(colorDistance({ r: 10, g: 20, b: 30 }, { r: 10, g: 20, b: 30 })).toBe(0)
  })

  it('is the euclidean distance', () => {
    expect(colorDistance({ r: 0, g: 0, b: 0 }, { r: 3, g: 4, b: 0 })).toBe(5)
  })
})

describe('estimateBackground', () => {
  it('finds the border colour', () => {
    const width = 5
    const height = 5
    const data = solid(width, height, [200, 210, 220])
    setPixel(data, width, 2, 2, [10, 10, 10])
    expect(estimateBackground(data, width, height)).toEqual({ r: 200, g: 210, b: 220 })
  })

  it('uses a median, so a stray edge object does not skew it', () => {
    const width = 4
    const height = 4
    const data = solid(width, height, [255, 255, 255])
    // A dark blob touching the top-left corner.
    setPixel(data, width, 0, 0, [0, 0, 0])
    const estimate = estimateBackground(data, width, height)
    expect(estimate.r).toBeGreaterThan(200)
  })
})

describe('backgroundMask', () => {
  it('marks the border background and leaves the subject alone', () => {
    const width = 7
    const height = 7
    const data = solid(width, height, [255, 255, 255])
    setPixel(data, width, 3, 3, [0, 0, 0])
    const mask = backgroundMask(data, width, height, { r: 255, g: 255, b: 255 }, 10)
    expect(mask[3 * width + 3]).toBe(0)
    expect(mask[0]).toBe(1)
  })

  it('keeps an interior region that happens to match the background colour', () => {
    const width = 7
    const height = 7
    const data = solid(width, height, [255, 255, 255])
    // A black ring enclosing a white hole in the middle.
    for (let x = 2; x <= 4; x += 1) {
      setPixel(data, width, x, 2, [0, 0, 0])
      setPixel(data, width, x, 4, [0, 0, 0])
    }
    setPixel(data, width, 2, 3, [0, 0, 0])
    setPixel(data, width, 4, 3, [0, 0, 0])
    const mask = backgroundMask(data, width, height, { r: 255, g: 255, b: 255 }, 10)
    expect(mask[3 * width + 3]).toBe(0)
  })

  it('respects tolerance', () => {
    const width = 3
    const height = 3
    const data = solid(width, height, [255, 255, 255])
    setPixel(data, width, 1, 1, [250, 250, 250])
    const tight = backgroundMask(data, width, height, { r: 255, g: 255, b: 255 }, 0)
    const loose = backgroundMask(data, width, height, { r: 255, g: 255, b: 255 }, 20)
    expect(tight[1 * width + 1]).toBe(0)
    expect(loose[1 * width + 1]).toBe(1)
  })

  it('returns an all-zero mask for a single-colour image only where unreachable', () => {
    const data = pixels([
      [10, 10, 10, 255], [10, 10, 10, 255],
      [10, 10, 10, 255], [10, 10, 10, 255],
    ])
    const mask = backgroundMask(data, 2, 2, { r: 10, g: 10, b: 10 }, 10)
    expect(Array.from(mask)).toEqual([1, 1, 1, 1])
  })

  it('drift 0 is the plain global fill: a pixel far from the backdrop stays', () => {
    const width = 5
    const height = 5
    // Backdrop averages to mid-grey, but the right half drifts lighter.
    const data = solid(width, height, [100, 100, 100])
    for (let y = 0; y < height; y += 1) for (let x = 2; x < width; x += 1) setPixel(data, width, x, y, [200, 200, 200])
    const estimated = { r: 150, g: 150, b: 150 }
    const mask = backgroundMask(data, width, height, estimated, 5, 0)
    // The far side is 87 away, well past the tolerance, so it is left as subject.
    expect(mask[2 * width + 4]).toBe(0)
  })

  it('drift follows a soft gradient across the whole backdrop', () => {
    const width = 9
    const height = 9
    const data = solid(width, height, [0, 0, 0])
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const shade = 60 + Math.round((x / (width - 1)) * 160)
        setPixel(data, width, x, y, [shade, shade, shade])
      }
    }
    const estimated = { r: 140, g: 140, b: 140 }
    // No single flat colour matches both ends within tolerance...
    const plain = backgroundMask(data, width, height, estimated, 5, 0)
    // ...but continuity walks it, one small step at a time.
    const drifted = backgroundMask(data, width, height, estimated, 5, 30)
    expect(plain[4 * width + 7]).toBe(0)
    expect(drifted[4 * width + 7]).toBe(1)
  })

  it('drift will not flood a subject that is far from the backdrop', () => {
    const width = 9
    const height = 9
    const data = solid(width, height, [100, 100, 100])
    // A flat pale subject block in the middle.
    for (let y = 2; y <= 6; y += 1) for (let x = 2; x <= 6; x += 1) setPixel(data, width, x, y, [250, 250, 250])
    // With drift 40 the step budget is ~177, and the edge jump (150) is inside
    // it — a step-only rule would flood straight through. The added bound
    // (distance from the backdrop, 259) is what keeps the subject intact.
    const mask = backgroundMask(data, width, height, { r: 100, g: 100, b: 100 }, 10, 40)
    for (let y = 2; y <= 6; y += 1) {
      for (let x = 2; x <= 6; x += 1) expect(mask[y * width + x]).toBe(0)
    }
    expect(mask[0]).toBe(1)
  })

  it('drift stops at a sharp edge and cannot jump a subject', () => {
    const width = 9
    const height = 9
    // A dark bar straight down the middle, gradient backdrop either side.
    const data = solid(width, height, [0, 0, 0])
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const inBar = x === 4
        const shade = inBar ? 0 : 60 + Math.round((x / (width - 1)) * 160)
        setPixel(data, width, x, y, [shade, shade, shade])
      }
    }
    const estimated = { r: 140, g: 140, b: 140 }
    const mask = backgroundMask(data, width, height, estimated, 12, 40)
    expect(mask[4 * width + 4]).toBe(0)
  })
})

describe('borderSpread', () => {
  it('scores a flat border near zero', () => {
    const data = solid(8, 8, [120, 120, 120])
    expect(borderSpread(data, 8, 8)).toBeLessThan(1)
  })

  it('scores a gradient border higher than a flat one', () => {
    const flat = solid(12, 12, [120, 120, 120])
    const ramp = solid(12, 12, [0, 0, 0])
    for (let y = 0; y < 12; y += 1) for (let x = 0; x < 12; x += 1) setPixel(ramp, 12, x, y, [x * 20, x * 20, x * 20])
    expect(borderSpread(ramp, 12, 12)).toBeGreaterThan(borderSpread(flat, 12, 12) + 10)
  })
})

describe('featherMask', () => {
  it('returns the mask unchanged at radius zero', () => {
    const mask = Uint8Array.from([1, 0, 1, 0])
    expect(Array.from(featherMask(mask, 2, 2, 0))).toEqual([1, 0, 1, 0])
  })

  it('produces fractional values at a hard edge', () => {
    const mask = Uint8Array.from([1, 1, 0, 0])
    const blurred = featherMask(mask, 4, 1, 1)
    expect(blurred[1]).toBeGreaterThan(0)
    expect(blurred[1]).toBeLessThan(1)
  })

  it('keeps values inside 0-1', () => {
    const mask = Uint8Array.from([1, 0, 1, 0, 1, 0])
    for (const value of featherMask(mask, 3, 2, 2)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
})

describe('applyMask', () => {
  it('makes background pixels transparent and keeps the subject opaque', () => {
    const data = pixels([
      [0, 0, 0, 255], [0, 0, 0, 255],
    ])
    applyMask(data, Uint8Array.from([1, 0]))
    expect(data[3]).toBe(0)
    expect(data[7]).toBe(255)
  })

  it('supports fractional alpha from a feathered mask', () => {
    const data = pixels([[0, 0, 0, 255]])
    applyMask(data, Float32Array.from([0.5]))
    expect(data[3]).toBe(128)
  })
})

describe('despill', () => {
  it('clamps a green-dominant backdrop out of the pixels', () => {
    const data = pixels([[100, 200, 100, 255]])
    despill(data, { r: 0, g: 255, b: 0 }, 1)
    expect(data[1]).toBe(100)
  })

  it('leaves pixels alone when the dominant channel is not highest', () => {
    const data = pixels([[200, 50, 50, 255]])
    despill(data, { r: 0, g: 255, b: 0 }, 1)
    expect(Array.from(data.slice(0, 3))).toEqual([200, 50, 50])
  })

  it('does nothing at zero strength', () => {
    const data = pixels([[100, 200, 100, 255]])
    despill(data, { r: 0, g: 255, b: 0 }, 0)
    expect(data[1]).toBe(200)
  })
})

describe('removeBackground', () => {
  it('makes a flat backdrop transparent and keeps the subject', () => {
    const width = 5
    const height = 5
    const data = solid(width, height, [240, 240, 240])
    setPixel(data, width, 2, 2, [20, 20, 20])
    const result = removeBackground(data, width, height, { tolerance: 12, drift: 0, feather: 0, despill: 0 })
    expect(result[3]).toBe(0)
    expect(result[(2 * width + 2) * 4 + 3]).toBe(255)
  })

  it('does not mutate the source buffer', () => {
    const width = 3
    const height = 3
    const data = solid(width, height, [255, 255, 255])
    removeBackground(data, width, height, { tolerance: 10, drift: 0, feather: 0, despill: 0 })
    expect(data[3]).toBe(255)
  })

  it('lets an erase stroke remove part of the subject', () => {
    const width = 7
    const height = 7
    const data = solid(width, height, [255, 255, 255])
    for (let y = 2; y <= 4; y += 1) for (let x = 2; x <= 4; x += 1) setPixel(data, width, x, y, [20, 20, 20])
    const clean = removeBackground(data, width, height, { tolerance: 10, drift: 0, feather: 0, despill: 0 })
    expect(clean[(3 * width + 3) * 4 + 3]).toBe(255)
    const painted = removeBackground(data, width, height, { tolerance: 10, drift: 0, feather: 0, despill: 0 }, undefined, [
      { mode: 'erase', radius: 1, points: [{ x: 3, y: 3 }] },
    ])
    expect(painted[(3 * width + 3) * 4 + 3]).toBe(0)
  })

  it('lets a restore stroke bring back part of the removed backdrop', () => {
    const width = 7
    const height = 7
    const data = solid(width, height, [255, 255, 255])
    const painted = removeBackground(data, width, height, { tolerance: 10, drift: 0, feather: 0, despill: 0 }, undefined, [
      { mode: 'restore', radius: 1, points: [{ x: 0, y: 0 }] },
    ])
    expect(painted[3]).toBe(255)
  })
})

describe('paintStroke', () => {
  it('erases by marking a disc as background', () => {
    const width = 5
    const height = 5
    const mask = new Uint8Array(width * height)
    paintStroke(mask, width, height, { mode: 'erase', radius: 1, points: [{ x: 2, y: 2 }] })
    expect(mask[2 * width + 2]).toBe(1)
    expect(mask[2 * width + 0]).toBe(0)
  })

  it('restores by marking a disc as subject', () => {
    const width = 5
    const height = 5
    const mask = new Uint8Array(width * height).fill(1)
    paintStroke(mask, width, height, { mode: 'restore', radius: 2, points: [{ x: 2, y: 2 }] })
    expect(mask[2 * width + 2]).toBe(0)
  })

  it('interpolates between distant points so a fast drag is solid', () => {
    const width = 20
    const height = 4
    const mask = new Uint8Array(width * height)
    paintStroke(mask, width, height, { mode: 'erase', radius: 1, points: [{ x: 1, y: 2 }, { x: 18, y: 2 }] })
    // Every pixel along the middle row should have been erased.
    for (let x = 0; x < width; x += 1) expect(mask[2 * width + x]).toBe(1)
  })

  it('clips to the image bounds without throwing', () => {
    const mask = new Uint8Array(4 * 4)
    expect(() => paintStroke(mask, 4, 4, { mode: 'erase', radius: 3, points: [{ x: -2, y: -2 }, { x: 9, y: 9 }] })).not.toThrow()
  })
})

describe('hexToRgb / rgbToHex', () => {
  it('parses six- and three-digit hex', () => {
    expect(hexToRgb('#ff8800')).toEqual({ r: 255, g: 136, b: 0 })
    expect(hexToRgb('#f80')).toEqual({ r: 255, g: 136, b: 0 })
  })

  it('round-trips through rgbToHex', () => {
    expect(rgbToHex({ r: 12, g: 200, b: 34 })).toBe('#0cc822')
    expect(hexToRgb(rgbToHex({ r: 10, g: 20, b: 30 }))).toEqual({ r: 10, g: 20, b: 30 })
  })

  it('falls back to black for junk', () => {
    expect(hexToRgb('nope')).toEqual({ r: 0, g: 0, b: 0 })
  })
})

describe('fillColorAt', () => {
  it('returns null for transparent', () => {
    expect(fillColorAt({ kind: 'transparent' }, 10, 10, 3, 3)).toBeNull()
  })

  it('returns the same colour everywhere for a solid fill', () => {
    const fill = { kind: 'solid', color: { r: 1, g: 2, b: 3 } } as const
    expect(fillColorAt(fill, 10, 10, 0, 0)).toEqual({ r: 1, g: 2, b: 3 })
    expect(fillColorAt(fill, 10, 10, 9, 9)).toEqual({ r: 1, g: 2, b: 3 })
  })

  it('runs left to right at 0 degrees', () => {
    const fill = { kind: 'linear', from: { r: 0, g: 0, b: 0 }, to: { r: 255, g: 255, b: 255 }, angle: 0 } as const
    expect(fillColorAt(fill, 11, 11, 0, 5)?.r).toBe(0)
    expect(fillColorAt(fill, 11, 11, 10, 5)?.r).toBe(255)
    expect(fillColorAt(fill, 11, 11, 5, 5)?.r).toBeCloseTo(127.5, 0)
  })

  it('runs top to bottom at 90 degrees', () => {
    const fill = { kind: 'linear', from: { r: 0, g: 0, b: 0 }, to: { r: 255, g: 255, b: 255 }, angle: 90 } as const
    expect(fillColorAt(fill, 11, 11, 5, 0)?.r).toBeCloseTo(0, 5)
    expect(fillColorAt(fill, 11, 11, 5, 10)?.r).toBe(255)
  })
})

describe('compositeBackground', () => {
  it('is a no-op for transparent', () => {
    const data = pixels([[10, 20, 30, 0]])
    compositeBackground(data, 1, 1, { kind: 'transparent' })
    expect(Array.from(data)).toEqual([10, 20, 30, 0])
  })

  it('fills transparent pixels with the colour and makes them opaque', () => {
    const data = pixels([[0, 0, 0, 0]])
    compositeBackground(data, 1, 1, { kind: 'solid', color: { r: 200, g: 100, b: 50 } })
    expect(Array.from(data)).toEqual([200, 100, 50, 255])
  })

  it('keeps opaque subject pixels', () => {
    const data = pixels([[9, 8, 7, 255]])
    compositeBackground(data, 1, 1, { kind: 'solid', color: { r: 200, g: 100, b: 50 } })
    expect(Array.from(data)).toEqual([9, 8, 7, 255])
  })

  it('blends a half-transparent edge pixel', () => {
    const data = pixels([[0, 0, 0, 128]])
    compositeBackground(data, 1, 1, { kind: 'solid', color: { r: 255, g: 255, b: 255 } })
    expect(data[0]).toBeGreaterThan(120)
    expect(data[0]).toBeLessThan(136)
    expect(data[3]).toBe(255)
  })

  it('paints a gradient across a row', () => {
    const data = new Uint8ClampedArray(3 * 4)
    compositeBackground(data, 3, 1, { kind: 'linear', from: { r: 0, g: 0, b: 0 }, to: { r: 240, g: 0, b: 0 }, angle: 0 })
    expect(data[0]).toBe(0)
    expect(data[8]).toBe(240)
  })
})
