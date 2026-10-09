import { beforeEach, describe, expect, it } from 'vitest'
import {
  PALETTE_KEYS,
  PRESETS,
  activeTheme,
  applyThemeToDocument,
  basePalette,
  customFrom,
  inkFor,
  isHex,
  onThemeChange,
  presetById,
  resolvePalette,
  strongFor,
  useCustom,
  usePreset,
} from './theme'
import type { CustomTheme } from './theme'

function installStorage(): Map<string, string> {
  const store = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  })
  return store
}

/** A document stub: one element with a dataset and inline style map. */
function installDocument() {
  const props: Record<string, string> = {}
  const dataset: Record<string, string> = {}
  const meta = { attrs: {} as Record<string, string>, setAttribute(k: string, v: string) { this.attrs[k] = v } }
  const root = {
    dataset,
    style: {
      setProperty: (name: string, value: string) => void (props[name] = value),
      getPropertyValue: (name: string) => props[name] ?? '',
    },
  }
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      documentElement: root,
      querySelector: (selector: string) => (selector.includes('theme-color') ? meta : null),
    },
  })
  return { props, dataset, meta }
}

describe('theme presets', () => {
  it('ships a spread of presets with unique ids', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(10)
    const ids = new Set(PRESETS.map((p) => p.id))
    expect(ids.size).toBe(PRESETS.length)
  })

  it('has both dark and light presets', () => {
    expect(PRESETS.some((p) => p.dark)).toBe(true)
    expect(PRESETS.some((p) => !p.dark)).toBe(true)
  })

  it('gives every preset a full, valid palette', () => {
    for (const preset of PRESETS) {
      for (const key of PALETTE_KEYS) {
        expect(isHex(preset.palette[key]), `${preset.id}.${key}`).toBe(true)
      }
      expect(isHex(preset.accent)).toBe(true)
    }
  })

  it('looks presets up by id', () => {
    expect(presetById('iris')?.name).toBe('Iris')
    expect(presetById('nope')).toBeUndefined()
  })
})

describe('theme maths', () => {
  it('picks ink that contrasts with the accent', () => {
    expect(inkFor('#ccff4d')).toBe('#0b0d11')
    expect(inkFor('#0b0d11')).toBe('#ffffff')
  })

  it('strengthens an accent toward the far end of the ramp', () => {
    const dark = strongFor('#808080', true)
    const light = strongFor('#808080', false)
    expect(dark).not.toBe('#808080')
    expect(light).not.toBe(dark)
  })

  it('leaves an unparseable accent alone', () => {
    expect(strongFor('not-a-colour', true)).toBe('not-a-colour')
  })

  it('validates hex', () => {
    expect(isHex('#AABBCC')).toBe(true)
    expect(isHex('#abc')).toBe(false)
    expect(isHex('red')).toBe(false)
  })
})

describe('theme storage', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = installStorage()
  })

  it('defaults to the first preset', () => {
    const active = activeTheme()
    expect(active.presetId).toBe('voltage')
    expect(active.dark).toBe(true)
  })

  it('round-trips a stored preset', () => {
    usePreset('paper')
    const active = activeTheme()
    expect(active.presetId).toBe('paper')
    expect(active.dark).toBe(false)
  })

  it('falls back when the stored preset no longer exists', () => {
    store.set('toolspace:theme', JSON.stringify({ presetId: 'deleted' }))
    expect(activeTheme().presetId).toBe('voltage')
  })

  it('round-trips a custom theme', () => {
    const custom: CustomTheme = {
      name: 'Mine',
      dark: true,
      base: 'voltage',
      palette: { bg: '#101010', border: '#222222' },
      accent: '#ff0080',
    }
    useCustom(custom)
    const active = activeTheme()
    expect(active.custom?.name).toBe('Mine')
    expect(active.accent).toBe('#ff0080')
    expect(active.palette.bg).toBe('#101010')
    // An override that was not set inherits from the base ramp.
    expect(active.palette.bgElevated).toBe(basePalette(true).bgElevated)
  })

  it('rejects a custom theme with an invalid accent', () => {
    store.set('toolspace:theme', JSON.stringify({ custom: { name: 'x', accent: 'pink' } }))
    expect(activeTheme().custom).toBeNull()
  })

  it('drops invalid palette entries but keeps the rest', () => {
    store.set(
      'toolspace:theme',
      JSON.stringify({
        custom: { accent: '#ff0080', name: 'x', dark: true, base: 'voltage', palette: { bg: 'nope', fg: '#ffffff' } },
      }),
    )
    const active = activeTheme()
    expect(active.palette.fg).toBe('#ffffff')
    expect(active.palette.bg).toBe(basePalette(true).bg)
  })

  it('notifies subscribers', () => {
    let calls = 0
    const off = onThemeChange(() => {
      calls += 1
    })
    usePreset('iris')
    expect(calls).toBe(1)
    off()
  })

  it('survives a corrupt blob', () => {
    store.set('toolspace:theme', 'not json')
    expect(activeTheme().presetId).toBe('voltage')
  })
})

describe('resolvePalette', () => {
  it('overlays only valid overrides', () => {
    const out = resolvePalette(basePalette(true), { bg: '#000000', fg: 'bad' })
    expect(out.bg).toBe('#000000')
    expect(out.fg).toBe(basePalette(true).fg)
  })
})

describe('customFrom', () => {
  it('records only the colours that differ from the base', () => {
    usePreset('iris')
    const custom = customFrom(activeTheme(), 'iris')
    expect(custom.palette).toEqual({})
    expect(custom.accent).toBe(presetById('iris')!.accent)
  })
})

describe('applyThemeToDocument', () => {
  let dom: ReturnType<typeof installDocument>

  beforeEach(() => {
    installStorage()
    dom = installDocument()
  })

  it('writes the ramp and accent onto the document', () => {
    usePreset('iris')
    applyThemeToDocument(activeTheme())
    expect(dom.dataset.theme).toBe('dark')
    expect(dom.props['--accent']).toBe(presetById('iris')!.accent)
    expect(dom.props['--bg']).toBe(presetById('iris')!.palette.bg)
  })

  it('derives the ink and strong accent', () => {
    usePreset('iris')
    applyThemeToDocument(activeTheme())
    expect(dom.props['--accent-ink']).toBe(inkFor(presetById('iris')!.accent))
    expect(dom.props['--accent-strong']).toBe(strongFor(presetById('iris')!.accent, true))
  })

  it('updates the theme-color meta tag', () => {
    usePreset('paper')
    applyThemeToDocument(activeTheme())
    expect(dom.meta.attrs.content).toBe(presetById('paper')!.palette.bg)
  })

  it('caches the resolved variables for the pre-paint script', () => {
    usePreset('iris')
    applyThemeToDocument(activeTheme())
    const cached = JSON.parse(localStorage.getItem('toolspace:theme-vars')!)
    expect(cached.dark).toBe(true)
    expect(cached.vars['--accent']).toBe(presetById('iris')!.accent)
  })

  it('survives a throwing localStorage when caching', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error('blocked')
        },
        removeItem: () => {},
      },
    })
    expect(() => applyThemeToDocument(activeTheme())).not.toThrow()
  })
})
