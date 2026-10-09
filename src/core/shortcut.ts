/**
 * The keyboard shortcut that opens the tool search.
 *
 * The binding is stored as an array of canonical tokens so it is both readable
 * in the settings blob and easy to compare: `['mod', 'k']` is the default. A
 * token is a modifier (`mod`, `ctrl`, `alt`, `shift`, `meta`) or the single
 * lower-case key the chord ends on, where `space` stands in for a literal gap.
 *
 * Pure logic only — turning a `KeyboardEvent` into a chord, parsing what a user
 * presses, and formatting it for display. Nothing here touches the DOM.
 */

export interface Chord {
  mod: boolean
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
  /** The single non-modifier key, lower-case, or `space`. */
  key: string
}

export const DEFAULT_SHORTCUT = ['mod', 'k'] as const

const MODIFIERS = ['mod', 'ctrl', 'alt', 'shift', 'meta'] as const

/** Canonical display names, so a chord reads the same everywhere. */
const KEY_LABELS: Record<string, string> = {
  space: 'Space',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  enter: 'Enter',
  escape: 'Esc',
  backspace: 'Backspace',
  delete: 'Delete',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  tab: 'Tab',
}

function normaliseKey(key: string): string {
  if (key === ' ' || key === 'spacebar') return 'space'
  return key.toLowerCase()
}

/** A `KeyboardEvent.key` value that can end a chord. Modifiers are excluded. */
function isBindableKey(key: string): boolean {
  if (key === 'Control' || key === 'Alt' || key === 'Shift' || key === 'Meta') return false
  const normalised = normaliseKey(key)
  return normalised.length === 1 || normalised in KEY_LABELS
}

/** Whether a chord is complete enough to be stored: at least one modifier and one key. */
export function isValidShortcut(tokens: string[]): boolean {
  const hasModifier = tokens.some((token) => (MODIFIERS as readonly string[]).includes(token))
  const keys = tokens.filter((token) => !(MODIFIERS as readonly string[]).includes(token))
  if (!hasModifier || keys.length !== 1) return false
  const [key] = keys
  return /^[a-z0-9]$/.test(key) || Object.prototype.hasOwnProperty.call(KEY_LABELS, key)
}

/** Turn a live keydown into a chord, or `null` and `modifiersOnly` while only modifiers are held. */
export function chordFromEvent(event: { key: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }): {
  chord: Chord | null
  modifiersOnly: boolean
} {
  if (!isBindableKey(event.key)) return { chord: null, modifiersOnly: true }
  return {
    chord: {
      mod: event.metaKey || event.ctrlKey,
      ctrl: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      meta: event.metaKey,
      key: normaliseKey(event.key),
    },
    modifiersOnly: false,
  }
}

/** Format a chord as tokens, in the canonical order. Returns `null` if unusable. */
export function tokensFromChord(chord: Chord): string[] | null {
  const tokens: string[] = []
  if (chord.mod) tokens.push('mod')
  if (chord.ctrl && !chord.mod) tokens.push('ctrl')
  if (chord.alt) tokens.push('alt')
  if (chord.shift) tokens.push('shift')
  if (chord.meta && !chord.mod) tokens.push('meta')
  if (!chord.key) return null
  tokens.push(chord.key)
  return isValidShortcut(tokens) ? tokens : null
}

/** Whether a keydown matches the stored shortcut tokens. */
export function matchesShortcut(tokens: string[], event: { key: string; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }): boolean {
  if (!isValidShortcut(tokens)) return false
  const wantMod = tokens.includes('mod')
  const wantCtrl = tokens.includes('ctrl')
  const wantAlt = tokens.includes('alt')
  const wantShift = tokens.includes('shift')
  const wantMeta = tokens.includes('meta')
  const key = tokens.find((token) => !(MODIFIERS as readonly string[]).includes(token))!

  // With `mod`, either Ctrl or Cmd satisfies it and the distinct ctrl/meta
  // tokens are absent, because a wildcard chord would defeat the point.
  const modSatisfied = wantMod ? event.ctrlKey || event.metaKey : true
  const ctrlSatisfied = wantCtrl ? event.ctrlKey && !event.metaKey : true
  const metaSatisfied = wantMeta ? event.metaKey && !event.ctrlKey : true
  const altSatisfied = event.altKey === wantAlt
  const shiftSatisfied = event.shiftKey === wantShift

  return modSatisfied && ctrlSatisfied && metaSatisfied && altSatisfied && shiftSatisfied && normaliseKey(event.key) === key
}

/** Human-readable form, using ⌘/⌥/⇧ on Apple platforms. */
export function formatShortcut(tokens: string[], apple = false): string {
  if (!isValidShortcut(tokens)) return ''
  const parts: string[] = []
  for (const token of tokens) {
    switch (token) {
      case 'mod':
        parts.push(apple ? '⌘' : 'Ctrl')
        break
      case 'ctrl':
        parts.push(apple ? '⌃' : 'Ctrl')
        break
      case 'alt':
        parts.push(apple ? '⌥' : 'Alt')
        break
      case 'shift':
        parts.push(apple ? '⇧' : 'Shift')
        break
      case 'meta':
        parts.push(apple ? '⌘' : 'Meta')
        break
      default:
        parts.push(KEY_LABELS[token] ?? token.toUpperCase())
    }
  }
  return parts.join(apple ? '' : '+')
}
