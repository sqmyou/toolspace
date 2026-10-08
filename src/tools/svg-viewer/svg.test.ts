import { describe, expect, it } from 'vitest'
import {
  extractColors,
  formatBytes,
  inspectSvg,
  looksLikeSvg,
  parseLength,
  parseViewBox,
  sanitizeSvg,
  svgCssUrl,
  svgDataUri,
} from './svg'

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80">
  <rect x="0" y="0" width="120" height="80" fill="#3366ff"/>
  <circle cx="40" cy="40" r="20" fill="rgb(255, 0, 0)" stroke="white"/>
  <path d="M0 0 L10 10" fill="none" stroke="#f00"/>
</svg>`

describe('looksLikeSvg', () => {
  it('recognises svg markup', () => {
    expect(looksLikeSvg(SAMPLE)).toBe(true)
    expect(looksLikeSvg('<svg/>')).toBe(true)
    expect(looksLikeSvg('<div>nope</div>')).toBe(false)
    expect(looksLikeSvg('')).toBe(false)
  })
})

describe('parseLength', () => {
  it('reads a plain number', () => {
    expect(parseLength('120')).toBe(120)
    expect(parseLength('12.5px')).toBe(12.5)
    expect(parseLength(' 10 px ')).toBe(10)
  })

  it('rejects relative or missing lengths', () => {
    expect(parseLength('100%')).toBeNull()
    expect(parseLength('2em')).toBeNull()
    expect(parseLength('')).toBeNull()
    expect(parseLength(null)).toBeNull()
    expect(parseLength('abc')).toBeNull()
  })
})

describe('parseViewBox', () => {
  it('reads four numbers separated by space or comma', () => {
    expect(parseViewBox('0 0 120 80')).toEqual({ x: 0, y: 0, width: 120, height: 80 })
    expect(parseViewBox('-10,-10,20,20')).toEqual({ x: -10, y: -10, width: 20, height: 20 })
  })

  it('rejects malformed or empty boxes', () => {
    expect(parseViewBox('0 0 10')).toBeNull()
    expect(parseViewBox('0 0 0 10')).toBeNull()
    expect(parseViewBox('a b c d')).toBeNull()
    expect(parseViewBox(null)).toBeNull()
  })
})

describe('extractColors', () => {
  it('collects hex, rgb and named colours without duplicates', () => {
    const colors = extractColors(SAMPLE)
    expect(colors).toContain('#3366ff')
    expect(colors).toContain('#f00')
    expect(colors).toContain('rgb(255,0,0)')
    expect(colors).toContain('white')
  })

  it('ignores transparent', () => {
    expect(extractColors('fill="transparent"')).toEqual([])
  })
})

describe('inspectSvg', () => {
  it('reads size, viewBox and counts', () => {
    const info = inspectSvg(SAMPLE)
    expect(info.width).toBe(120)
    expect(info.height).toBe(80)
    expect(info.viewBox).toEqual({ x: 0, y: 0, width: 120, height: 80 })
    expect(info.tags.find((entry) => entry.tag === 'rect')?.count).toBe(1)
    expect(info.elementCount).toBe(4)
  })

  it('flags scripts, handlers and external references', () => {
    const risky = '<svg width="10" height="10" onload="alert(1)"><script>alert(1)</script><image href="https://example.com/a.png"/></svg>'
    const info = inspectSvg(risky)
    expect(info.hasScript).toBe(true)
    expect(info.hasExternalRefs).toBe(true)
  })

  it('reports foreignObject', () => {
    const info = inspectSvg('<svg><foreignObject><div>x</div></foreignObject></svg>')
    expect(info.hasForeignObject).toBe(true)
  })

  it('stays clean for a plain graphic', () => {
    const info = inspectSvg(SAMPLE)
    expect(info.hasScript).toBe(false)
    expect(info.hasExternalRefs).toBe(false)
    expect(info.hasForeignObject).toBe(false)
  })

  it('uses absent dimensions without throwing', () => {
    const info = inspectSvg('<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>')
    expect(info.width).toBeNull()
    expect(info.height).toBeNull()
    expect(info.elementCount).toBe(2)
  })
})

describe('sanitizeSvg', () => {
  it('removes script blocks and reports them', () => {
    const { markup, removed } = sanitizeSvg('<svg><script>alert(1)</script><rect/></svg>')
    expect(markup).not.toMatch(/script/i)
    expect(markup).toContain('<rect/>')
    expect(removed).toContain('script')
  })

  it('removes self-closing script tags', () => {
    const { markup } = sanitizeSvg('<svg><script src="evil.js"/><rect/></svg>')
    expect(markup).not.toMatch(/script/i)
  })

  it('strips event handler attributes', () => {
    const { markup, removed } = sanitizeSvg('<svg><rect onclick="evil()" width="5"/></svg>')
    expect(markup).not.toMatch(/onclick/i)
    expect(removed).toContain('event handlers')
  })

  it('neutralises javascript: links', () => {
    const { markup, removed } = sanitizeSvg('<svg><a href="javascript:alert(1)"><rect/></a></svg>')
    expect(markup).not.toMatch(/javascript:/i)
    expect(removed).toContain('javascript: links')
  })

  it('neutralises nested data-uri images', () => {
    const { markup, removed } = sanitizeSvg('<svg><image href="data:image/svg+xml,<svg onload=alert(1)>"/></svg>')
    expect(markup).not.toMatch(/data:image\/svg\+xml/i)
    expect(removed).toContain('nested data images')
  })

  it('removes foreignObject and embedded media', () => {
    const { markup, removed } = sanitizeSvg('<svg><foreignObject><body/></foreignObject><video src="x"></video></svg>')
    expect(markup).not.toMatch(/foreignObject|video/i)
    expect(removed).toContain('embedded media')
  })

  it('leaves a clean graphic untouched', () => {
    const { markup, removed } = sanitizeSvg(SAMPLE)
    expect(markup).toBe(SAMPLE)
    expect(removed).toEqual([])
  })

  it('keeps https image references (they are only a privacy note, not code)', () => {
    const { markup } = sanitizeSvg('<svg><image href="https://example.com/a.png"/></svg>')
    expect(markup).toContain('https://example.com/a.png')
  })
})

describe('uri helpers', () => {
  it('encodes markup into a data uri', () => {
    expect(svgDataUri('<svg/>')).toBe('data:image/svg+xml,%3Csvg%2F%3E')
  })

  it('produces a CSS url() value', () => {
    expect(svgCssUrl('<svg/>')).toBe('url("data:image/svg+xml,%3Csvg%2F%3E")')
  })
})

describe('formatBytes', () => {
  it('scales the unit', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(2 * 1024 * 1024)).toBe('2.00 MB')
  })
})
