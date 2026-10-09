import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CHOICES,
  DEFAULTS,
  applySettings,
  networkEnabled,
  onSettingsChange,
  resetSettings,
  setNetworkEnabled,
  setSetting,
  setting,
  settings,
} from './settings'

/** A stand-in for localStorage, which node does not provide. */
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

/** A stand-in for the document element, so applySettings has somewhere to write. */
function installRoot(): Record<string, string> {
  const dataset: Record<string, string> = {}
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { documentElement: { dataset } },
  })
  return dataset
}

describe('settings', () => {
  let store: Map<string, string>
  let dataset: Record<string, string>

  beforeEach(() => {
    store = installStorage()
    dataset = installRoot()
  })

  it('starts with the defaults', () => {
    expect(settings()).toEqual(DEFAULTS)
    expect(networkEnabled()).toBe(true)
    expect(setting('density')).toBe('comfortable')
  })

  it('reads back a single value', () => {
    setSetting('showSigils', false)
    expect(setting('showSigils')).toBe(false)
  })

  it('writes through to localStorage', () => {
    setSetting('density', 'compact')
    const raw = JSON.parse(store.get('toolspace:settings')!)
    expect(raw.density).toBe('compact')
  })

  it('keeps other values when one changes', () => {
    setSetting('density', 'compact')
    setSetting('showStats', false)
    expect(setting('density')).toBe('compact')
    expect(setting('showStats')).toBe(false)
  })

  it('is the successor to the network preference', () => {
    setNetworkEnabled(false)
    expect(networkEnabled()).toBe(false)
  })

  it('notifies subscribers on change', () => {
    const spy = vi.fn()
    const off = onSettingsChange(spy)
    setSetting('density', 'compact')
    expect(spy).toHaveBeenCalledTimes(1)
    off()
    setSetting('density', 'comfortable')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('falls back to defaults on a corrupt blob', () => {
    store.set('toolspace:settings', '{ not json')
    expect(settings()).toEqual(DEFAULTS)
  })

  it('ignores unknown enum and non-boolean values', () => {
    store.set(
      'toolspace:settings',
      JSON.stringify({
        density: 'tiny',
        motion: 'warp',
        contentWidth: 'unbounded',
        showSigils: 'yes',
        recents: 3,
        autoCopy: null,
      }),
    )
    expect(settings()).toEqual(DEFAULTS)
  })

  it('accepts a partial blob, defaulting the rest', () => {
    store.set('toolspace:settings', JSON.stringify({ density: 'compact' }))
    expect(setting('density')).toBe('compact')
    expect(setting('showSigils')).toBe(true)
    expect(setting('contentWidth')).toBe('auto')
  })

  it('resetSettings restores every default', () => {
    setSetting('density', 'compact')
    setSetting('showSigils', false)
    resetSettings()
    expect(settings()).toEqual(DEFAULTS)
    expect(store.has('toolspace:settings')).toBe(false)
  })

  it('reflects the layout settings onto the document element', () => {
    setSetting('density', 'compact')
    setSetting('showSigils', false)
    setSetting('motion', 'reduced')
    setSetting('contentWidth', 'narrow')
    applySettings()
    expect(dataset).toMatchObject({
      density: 'compact',
      sigils: 'off',
      motion: 'reduced',
      width: 'narrow',
      stats: 'on',
    })
  })

  it('survives a throwing localStorage', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('blocked')
        },
        setItem: () => {
          throw new Error('blocked')
        },
        removeItem: () => {
          throw new Error('blocked')
        },
      },
    })
    expect(() => setSetting('density', 'compact')).not.toThrow()
    expect(settings()).toEqual(DEFAULTS)
  })

  it('offers choices for each enumerated setting', () => {
    expect(CHOICES.density.map((c) => c.value)).toEqual(['comfortable', 'compact'])
    expect(CHOICES.motion.map((c) => c.value)).toEqual(['system', 'full', 'reduced'])
    expect(CHOICES.contentWidth.map((c) => c.value)).toEqual(['auto', 'narrow', 'wide'])
  })
})
