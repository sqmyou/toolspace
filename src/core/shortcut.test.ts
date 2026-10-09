import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SHORTCUT,
  chordFromEvent,
  formatShortcut,
  isValidShortcut,
  matchesShortcut,
  tokensFromChord,
} from './shortcut'

const event = (key: string, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey', boolean>> = {}) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
})

describe('DEFAULT_SHORTCUT', () => {
  it('is mod plus k', () => {
    expect([...DEFAULT_SHORTCUT]).toEqual(['mod', 'k'])
  })
})

describe('isValidShortcut', () => {
  it('accepts a modifier and a single key', () => {
    expect(isValidShortcut(['mod', 'k'])).toBe(true)
    expect(isValidShortcut(['ctrl', 'shift', 'p'])).toBe(true)
    expect(isValidShortcut(['alt', 'space'])).toBe(true)
  })

  it('rejects a bare key with no modifier', () => {
    expect(isValidShortcut(['k'])).toBe(false)
  })

  it('rejects two keys', () => {
    expect(isValidShortcut(['mod', 'k', 'j'])).toBe(false)
  })

  it('rejects modifiers only', () => {
    expect(isValidShortcut(['mod', 'shift'])).toBe(false)
  })

  it('rejects a multi-character key it cannot name', () => {
    expect(isValidShortcut(['mod', 'f13'])).toBe(false)
  })
})

describe('chordFromEvent', () => {
  it('reports modifiers-only while a modifier is held', () => {
    expect(chordFromEvent(event('Control', { ctrlKey: true }))).toEqual({ chord: null, modifiersOnly: true })
    expect(chordFromEvent(event('Shift', { shiftKey: true }))).toEqual({ chord: null, modifiersOnly: true })
  })

  it('builds a chord from a real key', () => {
    expect(chordFromEvent(event('k', { ctrlKey: true })).chord).toEqual({
      mod: true,
      ctrl: true,
      alt: false,
      shift: false,
      meta: false,
      key: 'k',
    })
  })

  it('treats Cmd as mod on Apple', () => {
    const { chord } = chordFromEvent(event('k', { metaKey: true }))
    expect(chord?.mod).toBe(true)
    expect(chord?.meta).toBe(true)
  })

  it('normalises the space bar and upper case', () => {
    expect(chordFromEvent(event(' ', { altKey: true })).chord?.key).toBe('space')
    expect(chordFromEvent(event('K', { ctrlKey: true })).chord?.key).toBe('k')
  })
})

describe('tokensFromChord', () => {
  it('round-trips the default chord', () => {
    const { chord } = chordFromEvent(event('k', { ctrlKey: true }))
    expect(tokensFromChord(chord!)).toEqual(['mod', 'k'])
  })

  it('keeps distinct ctrl and meta apart from mod', () => {
    const { chord } = chordFromEvent(event('j', { ctrlKey: true, altKey: true, shiftKey: true }))
    expect(tokensFromChord(chord!)).toEqual(['mod', 'alt', 'shift', 'j'])
  })

  it('refuses a chord with no modifier', () => {
    const { chord } = chordFromEvent(event('k'))
    expect(tokensFromChord(chord!)).toBeNull()
  })
})

describe('matchesShortcut', () => {
  it('matches Ctrl and Cmd for a mod chord', () => {
    expect(matchesShortcut(['mod', 'k'], event('k', { ctrlKey: true }))).toBe(true)
    expect(matchesShortcut(['mod', 'k'], event('k', { metaKey: true }))).toBe(true)
  })

  it('does not match the wrong key or missing modifier', () => {
    expect(matchesShortcut(['mod', 'k'], event('j', { ctrlKey: true }))).toBe(false)
    expect(matchesShortcut(['mod', 'k'], event('k'))).toBe(false)
  })

  it('requires shift to match exactly', () => {
    expect(matchesShortcut(['mod', 'shift', 'p'], event('P', { ctrlKey: true, shiftKey: true }))).toBe(true)
    expect(matchesShortcut(['mod', 'shift', 'p'], event('p', { ctrlKey: true }))).toBe(false)
    expect(matchesShortcut(['mod', 'p'], event('p', { ctrlKey: true, shiftKey: true }))).toBe(false)
  })

  it('supports a space binding', () => {
    expect(matchesShortcut(['alt', 'space'], event(' ', { altKey: true }))).toBe(true)
  })

  it('never matches an invalid stored shortcut', () => {
    expect(matchesShortcut(['k'], event('k', { ctrlKey: true }))).toBe(false)
  })
})

describe('formatShortcut', () => {
  it('formats for a PC', () => {
    expect(formatShortcut(['mod', 'k'])).toBe('Ctrl+K')
    expect(formatShortcut(['ctrl', 'shift', 'p'])).toBe('Ctrl+Shift+P')
  })

  it('formats for Apple', () => {
    expect(formatShortcut(['mod', 'k'], true)).toBe('⌘K')
    expect(formatShortcut(['ctrl', 'shift', 'p'], true)).toBe('⌃⇧P')
  })

  it('names awkward keys', () => {
    expect(formatShortcut(['alt', 'space'])).toBe('Alt+Space')
    expect(formatShortcut(['mod', 'arrowup'], true)).toBe('⌘↑')
  })

  it('returns an empty string for an invalid chord', () => {
    expect(formatShortcut(['k'])).toBe('')
  })
})
