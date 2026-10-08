import { beforeEach, describe, expect, it, vi } from 'vitest'
import { favourites, isFavourite, onFavouritesChange, toggleFavourite } from './favourites'

/** A stand-in for the browser's localStorage, which node does not provide. */
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

describe('favourites', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = installStorage()
  })

  it('starts empty', () => {
    expect(favourites()).toEqual([])
    expect(isFavourite('base64')).toBe(false)
  })

  it('stars and unstars a tool', () => {
    expect(toggleFavourite('base64')).toBe(true)
    expect(isFavourite('base64')).toBe(true)
    expect(toggleFavourite('base64')).toBe(false)
    expect(isFavourite('base64')).toBe(false)
  })

  it('persists across reads', () => {
    toggleFavourite('base64')
    toggleFavourite('json-format')
    expect(favourites()).toEqual(['base64', 'json-format'])
    expect(JSON.parse(store.get('toolspace:favourites')!)).toEqual(['base64', 'json-format'])
  })

  it('keeps order of starring and does not duplicate', () => {
    toggleFavourite('a')
    toggleFavourite('b')
    toggleFavourite('a') // unstar
    toggleFavourite('a') // star again, appended at the end
    expect(favourites()).toEqual(['b', 'a'])
  })

  it('ignores corrupt or wrongly typed stored data', () => {
    store.set('toolspace:favourites', '{not json')
    expect(favourites()).toEqual([])

    store.set('toolspace:favourites', '{"a":1}')
    expect(favourites()).toEqual([])

    store.set('toolspace:favourites', '["ok",42,null]')
    expect(favourites()).toEqual(['ok'])
  })

  it('notifies subscribers on change', () => {
    const seen = vi.fn()
    const off = onFavouritesChange(seen)
    toggleFavourite('base64')
    expect(seen).toHaveBeenCalledTimes(1)
    off()
    toggleFavourite('base64')
    expect(seen).toHaveBeenCalledTimes(1)
  })

  it('survives a storage that throws, as private mode does', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('denied')
        },
        setItem: () => {
          throw new Error('denied')
        },
      },
    })
    expect(favourites()).toEqual([])
    expect(() => toggleFavourite('base64')).not.toThrow()
  })
})
