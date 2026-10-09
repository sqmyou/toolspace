import { describe, expect, it } from 'vitest'
import { anchorPoint, ANCHORS, planWatermark, resolveLogoSize, splitLines, textBlockSize } from './watermark'

describe('anchorPoint', () => {
  it('places a mark in each of the nine slots', () => {
    const box = { w: 100, h: 40 }
    const canvas = { w: 500, h: 300 }
    const p = 10
    const at = (anchor: (typeof ANCHORS)[number]) => anchorPoint(anchor, canvas.w, canvas.h, box.w, box.h, p)
    expect(at('top-left')).toEqual({ x: 10, y: 10 })
    expect(at('top-center')).toEqual({ x: 200, y: 10 })
    expect(at('top-right')).toEqual({ x: 390, y: 10 })
    expect(at('middle-center')).toEqual({ x: 200, y: 130 })
    expect(at('bottom-right')).toEqual({ x: 390, y: 250 })
    expect(at('bottom-left')).toEqual({ x: 10, y: 250 })
  })
})

describe('planWatermark', () => {
  const base = { anchor: 'bottom-right' as const, tiled: false, rotation: 0, padding: 10, gap: 6, canvasW: 500, canvasH: 300, markW: 100, markH: 40 }

  it('returns one placement when not tiled', () => {
    expect(planWatermark(base)).toEqual([{ x: 390, y: 250, rotation: 0 }])
  })

  it('keeps a mark inside a canvas smaller than the mark', () => {
    const plan = planWatermark({ ...base, canvasW: 60, canvasH: 20 })
    expect(plan[0].x).toBe(0)
    expect(plan[0].y).toBe(0)
  })

  it('tiles a grid that covers the whole canvas with a bleed', () => {
    const plan = planWatermark({ ...base, tiled: true })
    expect(plan.length).toBeGreaterThan(6)
    const xs = plan.map((p) => p.x)
    const ys = plan.map((p) => p.y)
    expect(Math.min(...xs)).toBeLessThan(0)
    expect(Math.max(...xs)).toBeGreaterThan(base.canvasW)
    expect(Math.min(...ys)).toBeLessThan(0)
    expect(Math.max(...ys)).toBeGreaterThan(base.canvasH)
  })

  it('staggers alternate tile rows', () => {
    const plan = planWatermark({ ...base, tiled: true })
    const ys = [...new Set(plan.map((p) => p.y))].sort((a, b) => a - b)
    const rowXs = (y: number) => plan.filter((p) => p.y === y).map((p) => p.x).sort((a, b) => a - b)
    expect(rowXs(ys[0])[0]).not.toBe(rowXs(ys[1])[0])
  })

  it('carries rotation through to every placement', () => {
    const plan = planWatermark({ ...base, tiled: true, rotation: 30 })
    expect(plan.every((p) => p.rotation === 30)).toBe(true)
  })

  it('is empty for a zero-sized mark', () => {
    expect(planWatermark({ ...base, markW: 0 })).toEqual([])
  })
})

describe('resolveLogoSize', () => {
  it('scales width to the percentage and keeps the aspect ratio', () => {
    expect(resolveLogoSize(200, 100, 20, 1000)).toEqual({ width: 200, height: 100 })
  })

  it('falls back to a square when the natural width is unknown', () => {
    expect(resolveLogoSize(0, 100, 10, 500)).toEqual({ width: 50, height: 50 })
  })
})

describe('splitLines', () => {
  it('splits on newlines', () => {
    expect(splitLines('a\nb\nc')).toEqual(['a', 'b', 'c'])
  })

  it('normalises CRLF and drops a trailing blank line', () => {
    expect(splitLines('a\r\nb\r\n')).toEqual(['a', 'b'])
  })

  it('keeps interior blank lines', () => {
    expect(splitLines('a\n\nb')).toEqual(['a', '', 'b'])
  })
})

describe('textBlockSize', () => {
  it('uses the widest line and the stacked line height', () => {
    expect(textBlockSize([120, 80], 2, 20, 1.5)).toEqual({ width: 120, height: 60 })
  })

  it('never reports a zero height', () => {
    expect(textBlockSize([], 0, 20).height).toBeGreaterThan(0)
  })
})
