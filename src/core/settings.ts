/**
 * Settings: one typed, versioned blob in localStorage.
 *
 * This is the successor to `preferences.ts`. It holds everything the Settings
 * page can change, so the page is a view over one store rather than a pile of
 * ad-hoc keys. Every field has a default, unknown values fall back, and a
 * corrupt blob degrades to defaults instead of throwing.
 *
 * `applySettings` writes the non-theme settings onto <html> as data
 * attributes; the stylesheet does the rest. That keeps the DOM work in one
 * place and means the view never has to know how a setting is honoured.
 */
import { DEFAULT_SHORTCUT, isValidShortcut } from './shortcut'

const KEY = 'toolspace:settings'

export interface Settings {
  /** Make tools that contact a third-party origin available at all. */
  networkTools: boolean
  /** Index row spacing. */
  density: 'comfortable' | 'compact'
  /** Show the per-tool sigil in lists and on tool pages. */
  showSigils: boolean
  /** Motion preference. `system` follows the OS. */
  motion: 'system' | 'full' | 'reduced'
  /** Reading column width for tool pages. */
  contentWidth: 'auto' | 'narrow' | 'wide'
  /** The stat strip under the masthead. */
  showStats: boolean
  /** Copy a tool's primary result as soon as it is produced. */
  autoCopy: boolean
  /** Remember the tools you opened, and show them on the home page. */
  recents: boolean
  /** The chord that opens the tool search, as canonical tokens. */
  searchShortcut: string[]
}

export const DEFAULTS: Settings = {
  networkTools: true,
  density: 'comfortable',
  showSigils: true,
  motion: 'system',
  contentWidth: 'auto',
  showStats: true,
  autoCopy: false,
  recents: true,
  searchShortcut: [...DEFAULT_SHORTCUT],
}

/** The options offered for each enumerated setting, in display order. */
export const CHOICES = {
  density: [
    { value: 'comfortable', label: 'Comfortable' },
    { value: 'compact', label: 'Compact' },
  ],
  motion: [
    { value: 'system', label: 'Follow system' },
    { value: 'full', label: 'Always on' },
    { value: 'reduced', label: 'Always reduced' },
  ],
  contentWidth: [
    { value: 'auto', label: 'Auto' },
    { value: 'narrow', label: 'Narrow' },
    { value: 'wide', label: 'Wide' },
  ],
} as const

type Listener = () => void
const listeners = new Set<Listener>()

function coerce(raw: unknown): Settings {
  const out: Settings = { ...DEFAULTS }
  if (typeof raw !== 'object' || raw === null) return out
  const value = raw as Record<string, unknown>
  if (typeof value.networkTools === 'boolean') out.networkTools = value.networkTools
  if (typeof value.showSigils === 'boolean') out.showSigils = value.showSigils
  if (typeof value.showStats === 'boolean') out.showStats = value.showStats
  if (typeof value.autoCopy === 'boolean') out.autoCopy = value.autoCopy
  if (typeof value.recents === 'boolean') out.recents = value.recents
  if (value.density === 'comfortable' || value.density === 'compact') out.density = value.density
  if (value.motion === 'system' || value.motion === 'full' || value.motion === 'reduced') {
    out.motion = value.motion
  }
  if (
    value.contentWidth === 'auto' ||
    value.contentWidth === 'narrow' ||
    value.contentWidth === 'wide'
  ) {
    out.contentWidth = value.contentWidth
  }
  if (Array.isArray(value.searchShortcut) && value.searchShortcut.every((token) => typeof token === 'string') && isValidShortcut(value.searchShortcut)) {
    out.searchShortcut = [...value.searchShortcut]
  }
  return out
}

export function settings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    return coerce(JSON.parse(raw))
  } catch {
    return { ...DEFAULTS }
  }
}

/** The current value of one setting, for a single-field read. */
export function setting<K extends keyof Settings>(name: K): Settings[K] {
  return settings()[name]
}

export function setSetting<K extends keyof Settings>(name: K, value: Settings[K]): void {
  const next = { ...settings(), [name]: value }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode: the choice still applies for this session */
  }
  applySettings(next)
  for (const listener of listeners) listener()
}

/** Forget every stored preference, returning the app to its defaults. */
export function resetSettings(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to do */
  }
  applySettings(DEFAULTS)
  for (const listener of listeners) listener()
}

/** Whether tools that use the network are available. Defaults true. */
export function networkEnabled(): boolean {
  return settings().networkTools
}

/** The chord that opens the tool search, as canonical tokens. */
export function searchShortcut(): string[] {
  return settings().searchShortcut
}

export function setNetworkEnabled(enabled: boolean): void {
  setSetting('networkTools', enabled)
}

/** Subscribe to setting changes, so the shell can re-render. */
export function onSettingsChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Reflect the settings the stylesheet needs onto <html>. Called on boot and
 * after every change, so there is one code path rather than a per-setting
 * sprinkle of class toggles.
 */
export function applySettings(value: Settings = settings()): void {
  const root = document.documentElement
  root.dataset.density = value.density
  root.dataset.sigils = value.showSigils ? 'on' : 'off'
  root.dataset.motion = value.motion
  root.dataset.width = value.contentWidth
  root.dataset.stats = value.showStats ? 'on' : 'off'
}
