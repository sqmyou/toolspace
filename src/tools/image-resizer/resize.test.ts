import { describe, expect, it } from 'vitest'
import { cropOffset, percentBox, presetById, presetsInGroup, resizeFilename, targetBox } from './resize'

describe('targetBox', () => {
  const source = { width: 4000, height: 3000 }

  it('fit keeps the aspect ratio inside the box', () => {
    expect(targetBox(source, { width: 1080, height: 1080 }, 'fit')).toEqual({ width: 1080, height: 810 })
  })

  it('fit never upscales a small source', () => {
    expect(targetBox({ width: 200, height: 100 }, { width: 1920, height: 1080 }, 'fit')).toEqual({ width: 200, height: 100 })
  })

  it('fill covers the box and overflows the short side', () => {
    // 4000x3000 into a 1080x1080 square: scale to 1080 wide, 810 tall would
    // not cover, so it scales to 1440x1080 and crops the width.
    expect(targetBox(source, { width: 1080, height: 1080 }, 'fill')).toEqual({ width: 1440, height: 1080 })
  })

  it('fill upscales when the source is smaller', () => {
    expect(targetBox({ width: 100, height: 100 }, { width: 512, height: 512 }, 'fill')).toEqual({ width: 512, height: 512 })
  })

  it('stretch hits the box exactly', () => {
    expect(targetBox(source, { width: 1200, height: 630 }, 'stretch')).toEqual({ width: 1200, height: 630 })
  })

  it('never returns a zero dimension', () => {
    const tiny = targetBox({ width: 10, height: 1000 }, { width: 1, height: 1 }, 'fit')
    expect(tiny.width).toBeGreaterThanOrEqual(1)
    expect(tiny.height).toBeGreaterThanOrEqual(1)
  })
})

describe('cropOffset', () => {
  it('centres an oversized drawing on the box', () => {
    expect(cropOffset({ width: 1440, height: 1080 }, { width: 1080, height: 1080 })).toEqual({ x: 180, y: 0 })
  })

  it('is zero when the drawing already matches the box', () => {
    expect(cropOffset({ width: 500, height: 500 }, { width: 500, height: 500 })).toEqual({ x: 0, y: 0 })
  })
})

describe('percentBox', () => {
  it('scales by a percentage', () => {
    expect(percentBox({ width: 1000, height: 500 }, 50)).toEqual({ width: 500, height: 250 })
  })

  it('never goes below one pixel', () => {
    expect(percentBox({ width: 1, height: 1 }, 1)).toEqual({ width: 1, height: 1 })
  })
})

describe('presets', () => {
  it('finds a preset by id', () => {
    expect(presetById('ig-square')).toMatchObject({ width: 1080, height: 1080 })
    expect(presetById('nope')).toBeUndefined()
  })

  it('groups presets', () => {
    expect(presetsInGroup('Social').length).toBeGreaterThan(0)
    expect(presetsInGroup('Web').every((preset) => preset.group === 'Web')).toBe(true)
  })

  it('has unique ids', () => {
    const ids = ['Social', 'Web', 'Video'].flatMap((group) => presetsInGroup(group as 'Social')).map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('resizeFilename', () => {
  it('records the output size', () => {
    expect(resizeFilename('holiday photo.png', { width: 1080, height: 1080 }, 'webp')).toBe(
      'holiday_photo-1080x1080.webp',
    )
  })

  it('copes with a file that has no extension', () => {
    expect(resizeFilename('screenshot', { width: 100, height: 50 }, 'png')).toBe('screenshot-100x50.png')
  })
})
