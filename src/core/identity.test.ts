import { describe, expect, it } from 'vitest'
import { categoryHue, MARK_FAMILIES, toolMarkSvg } from './identity'

// A slug set big enough to exercise every mark family several times over.
const SLUGS = [
  'aes-gcm', 'base-encodings', 'base64', 'binary-text', 'calculator', 'case-converter',
  'cidr', 'color-contrast', 'color-converter', 'cookie-parser', 'cron-explainer',
  'csv-json', 'date-math', 'duration-parser', 'env-converter', 'escape-toolkit',
  'fake-data', 'file-checksum', 'gitignore', 'hash-generator', 'hex-viewer',
  'http-status', 'id-generator', 'ini-json', 'json-diff', 'json-formatter',
  'json-lines', 'json-xml', 'jsonpath', 'jwt-decoder', 'lorem-ipsum',
  'magic-bytes', 'markdown-preview', 'mime-lookup', 'number-base',
  'number-formatter', 'palette-generator', 'password-strength', 'percentage',
  'regex-tester', 'semver-checker', 'shell-quote', 'slug-meta', 'sql-formatter',
  'svg-viewer', 'text-diff', 'text-stats', 'timestamp', 'url-editor',
  'user-agent', 'whitespace-cleaner', 'word-frequency', 'youtube-thumbnail',
]

const CATEGORIES = ['Data', 'Text', 'Numbers', 'Security', 'Web', 'Code', 'Media', 'Design']

describe('categoryHue', () => {
  it('returns a distinct hue per category across the wheel', () => {
    const hues = CATEGORIES.map(categoryHue)
    expect(new Set(hues).size).toBe(hues.length)
    expect(hues.every((h) => h >= 0 && h < 360)).toBe(true)
  })

  it('falls back to a valid hue for an unknown category', () => {
    const hue = categoryHue('Nonexistent')
    expect(hue).toBeGreaterThanOrEqual(0)
    expect(hue).toBeLessThan(360)
  })
})

describe('MARK_FAMILIES', () => {
  it('holds every family, and all are distinct generators', () => {
    expect(MARK_FAMILIES.length).toBeGreaterThanOrEqual(20)
    expect(new Set(MARK_FAMILIES).size).toBe(MARK_FAMILIES.length)
  })

  it('every family draws a valid mark on its own', () => {
    let seed = 1
    for (const family of MARK_FAMILIES) {
      // A deterministic pseudo-RNG so this test is not order-dependent.
      let state = seed++
      const r = () => {
        state = (state * 1664525 + 1013904223) % 4294967296
        return state / 4294967296
      }
      const svg = family(r)
      expect(svg.length).toBeGreaterThan(0)
      expect(svg).toMatch(/currentColor/)
      expect(svg).not.toMatch(/NaN|undefined/)
    }
  })
})

describe('toolMarkSvg', () => {
  it('is deterministic: a slug always draws the same mark', () => {
    expect(toolMarkSvg('jwt-decoder', 'Security')).toBe(toolMarkSvg('jwt-decoder', 'Security'))
  })

  it('gives every slug a distinct mark, within one category', () => {
    const marks = SLUGS.map((slug) => toolMarkSvg(slug, 'Data'))
    expect(new Set(marks).size).toBe(SLUGS.length)
  })

  it('gives every slug a distinct mark with no category at all', () => {
    const marks = SLUGS.map((slug) => toolMarkSvg(slug))
    expect(new Set(marks).size).toBe(SLUGS.length)
  })

  it('emits only clean SVG primitives tinted with currentColor', () => {
    for (const slug of SLUGS) {
      for (const category of CATEGORIES) {
        const svg = toolMarkSvg(slug, category)
        expect(svg).toMatch(/^<[a-z]/)
        expect(svg).toMatch(/currentColor/)
        expect(svg).not.toMatch(/NaN|undefined/)
      }
    }
  })

  it('falls back to a valid mark for an unknown category', () => {
    const svg = toolMarkSvg('mystery-tool', 'Nonexistent')
    expect(svg).toMatch(/^</)
    expect(svg).not.toMatch(/NaN|undefined/)
  })
})
