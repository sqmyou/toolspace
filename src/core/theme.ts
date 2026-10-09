/**
 * Themes: the one accent plus an optional custom background.
 *
 * The whole design is a near-greyscale ramp under a single accent, so a theme
 * is almost entirely the choice of that accent. Presets pin a well-known
 * accent to a dark or light ramp; a custom theme lets you pick both the accent
 * and the background and keeps it in localStorage next to your favourites.
 *
 * Nothing here touches the network. Only two things are written to the
 * document: the `--accent`/`--accent-ink` pair, and (for a custom background)
 * `--bg` plus a `data-bg` flag; the stylesheet derives every other shade from
 * those with `color-mix`, so there is no second palette to keep in sync.
 */
const ACCENT_KEY = 'toolspace:accent'
const MODE_KEY = 'toolspace:theme'

export interface ThemePreset {
  id: string
  name: string
  /** A bright accent for dark ramps, a deep one for light ramps. */
  accent: string
  dark: boolean
}

export interface CustomTheme {
  name: string
  dark: boolean
  accent: string
  /** Background override, or null to use the base ramp's own background. */
  bg: string | null
}

export interface ActiveTheme {
  /** The preset id in use, or null when a custom theme is active. */
  presetId: string | null
  custom: CustomTheme | null
  dark: boolean
  accent: string
  bg: string | null
  name: string
}

/** The default, and seven more: four dark, two light, one high-contrast. */
export const PRESETS: ThemePreset[] = [
  { id: 'voltage', name: 'Voltage', accent: '#ccff4d', dark: true },
  { id: 'iris', name: 'Iris', accent: '#a78bfa', dark: true },
  { id: 'glacier', name: 'Glacier', accent: '#38e0d4', dark: true },
  { id: 'ember', name: 'Ember', accent: '#ff8a4c', dark: true },
  { id: 'neon', name: 'Neon', accent: '#ff5c9d', dark: true },
  { id: 'paper', name: 'Paper', accent: '#4f7a12', dark: false },
  { id: 'cobalt', name: 'Cobalt', accent: '#2450c8', dark: false },
  { id: 'terminal', name: 'Terminal', accent: '#43ff6b', dark: true },
]

const DEFAULT_PRESET = 'voltage'

export function presetById(id: string): ThemePreset | undefined {
  return PRESETS.find((preset) => preset.id === id)
}

/* --- tiny colour maths, kept pure so it can be tested ----------------------- */

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

/** Parse `#rgb` or `#rrggbb`; returns null for anything else. */
export function parseHex(hex: string): [number, number, number] | null {
  const value = hex.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(value)) {
    return [
      parseInt(value[0] + value[0], 16),
      parseInt(value[1] + value[1], 16),
      parseInt(value[2] + value[2], 16),
    ]
  }
  if (/^[0-9a-f]{6}$/i.test(value)) {
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16),
    ]
  }
  return null
}

export function toHex(rgb: [number, number, number]): string {
  return '#' + rgb.map((c) => clampChannel(c).toString(16).padStart(2, '0')).join('')
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const rgb = parseHex(hex)
  if (!rgb) return 0
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Ink to place *on* an accent fill. A bright accent takes dark ink, a deep one
 * takes white, which is what keeps button labels legible in every preset.
 */
export function inkFor(accent: string): string {
  return luminance(accent) > 0.4 ? '#0b0d11' : '#ffffff'
}

/**
 * The bright variant used for focus rings and the skip link. On a dark ramp it
 * lifts toward white; on paper it deepens toward black. Either way it stays
 * the same hue, so a preset's ring is recognisably its own.
 */
export function strongFor(accent: string, dark: boolean): string {
  const rgb = parseHex(accent)
  if (!rgb) return accent
  const towards = dark ? 255 : 0
  return toHex(rgb.map((c) => c + (towards - c) * 0.22) as [number, number, number])
}

/* --- reading and writing ---------------------------------------------------- */

function readAccent(): { presetId?: string; custom?: CustomTheme } | null {
  try {
    const raw = localStorage.getItem(ACCENT_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const value = parsed as { presetId?: unknown; custom?: unknown }
    if (typeof value.presetId === 'string') return { presetId: value.presetId }
    if (typeof value.custom === 'object' && value.custom !== null) {
      const custom = value.custom as Partial<CustomTheme>
      if (
        typeof custom.accent === 'string' &&
        typeof custom.dark === 'boolean' &&
        parseHexSafely(custom.accent)
      ) {
        return {
          custom: {
            name: typeof custom.name === 'string' ? custom.name : 'Custom',
            dark: custom.dark,
            accent: custom.accent,
            bg: typeof custom.bg === 'string' && parseHexSafely(custom.bg) ? custom.bg : null,
          },
        }
      }
    }
    return null
  } catch {
    return null
  }
}

function parseHexSafely(value: string): boolean {
  return parseHex(value) !== null
}

/** The theme currently in effect, defaults included. */
export function activeTheme(): ActiveTheme {
  const stored = readAccent()
  if (stored?.custom) {
    return {
      presetId: null,
      custom: stored.custom,
      dark: stored.custom.dark,
      accent: stored.custom.accent,
      bg: stored.custom.bg,
      name: stored.custom.name,
    }
  }
  const preset = presetById(stored?.presetId ?? DEFAULT_PRESET) ?? presetById(DEFAULT_PRESET)!
  return {
    presetId: preset.id,
    custom: null,
    dark: preset.dark,
    accent: preset.accent,
    bg: null,
    name: preset.name,
  }
}

type Listener = () => void
const listeners = new Set<Listener>()

function persist(mode: 'dark' | 'light', payload: object): void {
  try {
    localStorage.setItem(MODE_KEY, mode)
    localStorage.setItem(ACCENT_KEY, JSON.stringify(payload))
  } catch {
    /* private mode: the choice still applies for this session */
  }
  for (const listener of listeners) listener()
}

export function usePreset(id: string): void {
  const preset = presetById(id) ?? presetById(DEFAULT_PRESET)!
  persist(preset.dark ? 'dark' : 'light', { presetId: preset.id })
}

export function useCustom(theme: CustomTheme): void {
  persist(theme.dark ? 'dark' : 'light', { custom: theme })
}

/** Subscribe to theme changes, so the shell can re-render. */
export function onThemeChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Write a theme onto the document. `--accent` is always set inline; the
 * background only when the theme overrides it, so a preset inherits the base
 * ramp it was designed against.
 */
export function applyThemeToDocument(theme: ActiveTheme): void {
  const root = document.documentElement
  root.dataset.theme = theme.dark ? 'dark' : 'light'
  root.style.setProperty('--accent', theme.accent)
  root.style.setProperty('--accent-ink', inkFor(theme.accent))
  root.style.setProperty('--accent-strong', strongFor(theme.accent, theme.dark))

  if (theme.bg) {
    root.dataset.bg = 'custom'
    root.style.setProperty('--bg', theme.bg)
  } else {
    delete root.dataset.bg
    root.style.removeProperty('--bg')
  }

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme.bg ?? (theme.dark ? '#0b0d11' : '#f6f7f4'))
}
