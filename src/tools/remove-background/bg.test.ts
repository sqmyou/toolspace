import { describe, expect, it } from 'vitest'
import { applyMask, backgroundMask, colorDistance, despill, estimateBackground, featherMask, removeBackground } from './bg'

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
    const result = removeBackground(data, width, height, { tolerance: 12, feather: 0, despill: 0 })
    expect(result[3]).toBe(0)
    expect(result[(2 * width + 2) * 4 + 3]).toBe(255)
  })

  it('does not mutate the source buffer', () => {
    const width = 3
    const height = 3
    const data = solid(width, height, [255, 255, 255])
    removeBackground(data, width, height, { tolerance: 10, feather: 0, despill: 0 })
    expect(data[3]).toBe(255)
  })
})
