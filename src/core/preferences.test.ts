import { beforeEach, describe, expect, it } from 'vitest'
import { networkEnabled, onPreferencesChange, preferences, setNetworkEnabled } from './preferences'

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

describe('preferences', () => {
  let store: Map<string, string>
  beforeEach(() => {
    store = installStorage()
  })

  it('defaults to network tools enabled', () => {
    expect(preferences()).toEqual({ networkTools: true })
    expect(networkEnabled()).toBe(true)
  })

  it('persists a change and reports it', () => {
    setNetworkEnabled(false)
    expect(networkEnabled()).toBe(false)
    expect(JSON.parse(store.get('toolspace:prefs')!)).toEqual({ networkTools: false })
    setNetworkEnabled(true)
    expect(networkEnabled()).toBe(true)
  })

  it('falls back to defaults on corrupt or non-object data', () => {
    store.set('toolspace:prefs', '{not json')
    expect(networkEnabled()).toBe(true)
    store.set('toolspace:prefs', '["array"]')
    expect(networkEnabled()).toBe(true)
    store.set('toolspace:prefs', '{"networkTools":"yes"}')
    expect(networkEnabled()).toBe(true)
  })

  it('notifies subscribers and unsubscribes cleanly', () => {
    let calls = 0
    const off = onPreferencesChange(() => {
      calls += 1
    })
    setNetworkEnabled(false)
    expect(calls).toBe(1)
    off()
    setNetworkEnabled(true)
    expect(calls).toBe(1)
  })

  it('still applies for the session when storage throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => {
          throw new Error('private mode')
        },
        setItem: () => {
          throw new Error('private mode')
        },
      },
      configurable: true,
    })
    expect(networkEnabled()).toBe(true)
    expect(() => setNetworkEnabled(false)).not.toThrow()
  })
})
