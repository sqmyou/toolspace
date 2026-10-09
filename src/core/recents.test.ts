import { beforeEach, describe, expect, it } from 'vitest'
import { clearRecents, onRecentsChange, recents, remember } from './recents'

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

describe('recents', () => {
  beforeEach(() => {
    installStorage()
  })

  it('starts empty', () => {
    expect(recents()).toEqual([])
  })

  it('remembers visits newest first', () => {
    remember('jwt')
    remember('base64')
    expect(recents()).toEqual(['base64', 'jwt'])
  })

  it('does not duplicate a tool, it moves it to the front', () => {
    remember('jwt')
    remember('base64')
    remember('jwt')
    expect(recents()).toEqual(['jwt', 'base64'])
  })

  it('caps the list', () => {
    for (let i = 0; i < 20; i += 1) remember(`tool-${i}`)
    expect(recents()).toHaveLength(8)
    expect(recents()[0]).toBe('tool-19')
  })

  it('clears', () => {
    remember('jwt')
    clearRecents()
    expect(recents()).toEqual([])
  })

  it('notifies subscribers', () => {
    let calls = 0
    const off = onRecentsChange(() => {
      calls += 1
    })
    remember('jwt')
    expect(calls).toBe(1)
    off()
    remember('base64')
    expect(calls).toBe(1)
  })

  it('ignores a corrupt blob', () => {
    localStorage.setItem('toolspace:recent', 'not json')
    expect(recents()).toEqual([])
  })
})
