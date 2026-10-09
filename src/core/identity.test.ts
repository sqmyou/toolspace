import { describe, expect, it } from 'vitest'
import { categoryHue, toolMarkSvg } from './identity'

// A slug set big enough to exercise every mark family several times over.
const SLUGS = [
  'aes-gcm', 'base32', 'base64', 'binary-text', 'calculator', 'case-converter',
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

describe('categoryHue', () => {
  it('returns a distinct hue per category across the wheel', () => {
    const hues = ['Code', 'Data', 'Design', 'Media', 'Numbers', 'Security', 'Text', 'Web'].map(categoryHue)
    expect(new Set(hues).size).toBe(hues.length)
    expect(hues.every((h) => h >= 0 && h < 360)).toBe(true)
  })

  it('falls back to a valid hue for an unknown category', () => {
    const hue = categoryHue('Nonexistent')
    expect(hue).toBeGreaterThanOrEqual(0)
    expect(hue).toBeLessThan(360)
  })
})

describe('toolMarkSvg', () => {
  it('is deterministic: a slug always draws the same mark', () => {
    expect(toolMarkSvg('jwt-decoder')).toBe(toolMarkSvg('jwt-decoder'))
  })

  it('gives every slug a distinct mark', () => {
    const marks = SLUGS.map(toolMarkSvg)
    expect(new Set(marks).size).toBe(SLUGS.length)
  })

  it('emits only clean SVG primitives tinted with currentColor', () => {
    for (const slug of SLUGS) {
      const svg = toolMarkSvg(slug)
      expect(svg).toMatch(/^<[a-z]/)
      expect(svg).toMatch(/currentColor/)
      expect(svg).not.toMatch(/NaN|undefined/)
    }
  })
})
