import { beforeEach, describe, expect, it } from 'vitest'
import {
  PRESETS,
  activeTheme,
  inkFor,
  luminance,
  onThemeChange,
  parseHex,
  presetById,
  strongFor,
  toHex,
  useCustom,
  usePreset,
} from './theme'

/** A stand-in for the browser's localStorage, which node does not provide. */
function installStorage() {
  const store = new Map<string, string>()
  const fake = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  }
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true })
  return store
}

describe('theme presets', () => {
  it('ships at least five and has a unique id and accent each', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5)
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length)
    expect(new Set(PRESETS.map((p) => p.accent.toLowerCase())).size).toBe(PRESETS.length)
    expect(PRESETS.every((p) => parseHex(p.accent) !== null)).toBe(true)
  })

  it('has both dark and light options', () => {
    expect(PRESETS.some((p) => p.dark)).toBe(true)
    expect(PRESETS.some((p) => !p.dark)).toBe(true)
  })

  it('defaults to the first preset', () => {
    installStorage()
    const theme = activeTheme()
    expect(theme.presetId).toBe(PRESETS[0].id)
    expect(theme.accent).toBe(PRESETS[0].accent)
    expect(theme.custom).toBeNull()
  })
})

describe('colour maths', () => {
  it('parses #rgb and #rrggbb, and rejects nonsense', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255])
    expect(parseHex('ccff4d')).toEqual([204, 255, 77])
    expect(parseHex('#12345')).toBeNull()
    expect(parseHex('rebeccapurple')).toBeNull()
  })

  it('round-trips a colour through toHex', () => {
    expect(toHex([204, 255, 77])).toBe('#ccff4d')
    expect(toHex([0, 0, 0])).toBe('#000000')
    expect(toHex([300, -5, 12])).toBe('#ff000c')
  })

  it('orders luminance black < grey < white', () => {
    expect(luminance('#000000')).toBeLessThan(luminance('#808080'))
    expect(luminance('#808080')).toBeLessThan(luminance('#ffffff'))
  })

  it('picks legible ink for the accent', () => {
    expect(inkFor('#ccff4d')).toBe('#0b0d11')
    expect(inkFor('#2450c8')).toBe('#ffffff')
  })

  it('lifts the focus colour on dark and deepens it on light', () => {
    const dark = strongFor('#ccff4d', true)
    const light = strongFor('#4f7a12', false)
    expect(luminance(dark)).toBeGreaterThan(luminance('#ccff4d'))
    expect(luminance(light)).toBeLessThan(luminance('#4f7a12'))
  })
})

describe('stored themes', () => {
  let store: Map<string, string>
  beforeEach(() => {
    store = installStorage()
  })

  it('persists a preset choice and reports the change', () => {
    const seen: string[] = []
    onThemeChange(() => seen.push('change'))
    usePreset('iris')
    expect(seen).toEqual(['change'])
    expect(activeTheme().presetId).toBe('iris')
    expect(activeTheme().accent).toBe('#a78bfa')
    expect(JSON.parse(store.get('toolspace:accent')!)).toEqual({ presetId: 'iris' })
    expect(store.get('toolspace:theme')).toBe('dark')
  })

  it('switches the mode for a light preset', () => {
    usePreset('paper')
    expect(store.get('toolspace:theme')).toBe('light')
    expect(activeTheme().dark).toBe(false)
  })

  it('ignores an unknown preset id', () => {
    usePreset('nope')
    expect(activeTheme().presetId).toBe(PRESETS[0].id)
  })

  it('stores and restores a custom theme', () => {
    useCustom({ name: 'Mine', dark: true, accent: '#ff0080', bg: '#101418' })
    const theme = activeTheme()
    expect(theme.presetId).toBeNull()
    expect(theme.name).toBe('Mine')
    expect(theme.accent).toBe('#ff0080')
    expect(theme.bg).toBe('#101418')
  })

  it('rejects a custom theme with a bad accent and falls back to the default', () => {
    store.set('toolspace:accent', JSON.stringify({ custom: { accent: 'not-a-colour', dark: true } }))
    expect(activeTheme().presetId).toBe(PRESETS[0].id)
  })

  it('drops a bad background but keeps the accent', () => {
    store.set(
      'toolspace:accent',
      JSON.stringify({ custom: { name: 'X', accent: '#336699', dark: true, bg: 'garbage' } }),
    )
    const theme = activeTheme()
    expect(theme.accent).toBe('#336699')
    expect(theme.bg).toBeNull()
  })

  it('falls back to the default on corrupt storage', () => {
    store.set('toolspace:accent', '{not json')
    expect(activeTheme().presetId).toBe(PRESETS[0].id)
  })

  it('exposes presetById', () => {
    expect(presetById('ember')?.name).toBe('Ember')
    expect(presetById('missing')).toBeUndefined()
  })
})
