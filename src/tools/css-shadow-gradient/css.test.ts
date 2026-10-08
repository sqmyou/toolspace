import { describe, expect, it } from 'vitest'
import { boxShadowCss, gradientCss, parseHex, ruleFor, shadowLayerCss, toHex } from './css'

describe('shadowLayerCss', () => {
  it('formats a layer', () => {
    expect(shadowLayerCss({ x: 0, y: 4, blur: 8, spread: 0, color: 'rgba(0,0,0,0.2)', inset: false }))
      .toBe('0px 4px 8px 0px rgba(0,0,0,0.2)')
  })

  it('includes the inset keyword', () => {
    expect(shadowLayerCss({ x: 1, y: 1, blur: 2, spread: 3, color: 'red', inset: true }))
      .toBe('inset 1px 1px 2px 3px red')
  })
})

describe('boxShadowCss', () => {
  it('joins layers with commas', () => {
    const css = boxShadowCss([
      { x: 0, y: 1, blur: 2, spread: 0, color: '#000', inset: false },
      { x: 0, y: 2, blur: 4, spread: 0, color: '#111', inset: false },
    ])
    expect(css.split(', ')).toHaveLength(2)
  })

  it('returns none for no layers', () => {
    expect(boxShadowCss([])).toBe('none')
  })
})

describe('gradientCss', () => {
  it('sorts stops and formats linear gradients', () => {
    const css = gradientCss({ type: 'linear', angle: 90, stops: [{ color: '#fff', position: 100 }, { color: '#000', position: 0 }] })
    expect(css).toBe('linear-gradient(90deg, #000 0%, #fff 100%)')
  })

  it('formats radial gradients', () => {
    const css = gradientCss({ type: 'radial', angle: 0, stops: [{ color: '#abc', position: 0 }, { color: '#def', position: 50 }] })
    expect(css).toBe('radial-gradient(circle, #abc 0%, #def 50%)')
  })
})

describe('ruleFor', () => {
  it('builds a CSS rule with indentation', () => {
    expect(ruleFor('.card', { 'box-shadow': 'none', background: '#fff' }))
      .toBe('.card {\n  box-shadow: none;\n  background: #fff;\n}')
  })
})

describe('colour helpers', () => {
  it('parses three- and six-digit hex', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseHex('000000')).toEqual({ r: 0, g: 0, b: 0 })
    expect(parseHex('#123456')).toEqual({ r: 18, g: 52, b: 86 })
  })

  it('rejects bad input', () => {
    expect(parseHex('#12')).toBeNull()
    expect(parseHex('not a colour')).toBeNull()
  })

  it('round-trips through toHex and clamps', () => {
    expect(toHex({ r: 18, g: 52, b: 86 })).toBe('#123456')
    expect(toHex({ r: 300, g: -5, b: 128 })).toBe('#ff0080')
  })
})
