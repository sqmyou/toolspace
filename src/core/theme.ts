/**
 * Themes: a full palette, not a single accent.
 *
 * A theme is a named set of surface, text and accent colours for a dark or a
 * light ramp. Presets ship every colour; a custom theme may set any subset and
 * inherits the rest from the ramp it is based on. Everything is written as
 * inline custom properties on <html>, which is all the stylesheet needs.
 *
 * There is no colour parsing here — the `<input type="color">` controls are
 * the only editor and they hand back `#rrggbb`, so validation is a regex and
 * the maths stays in the stylesheet via `color-mix`.
 */
const THEME_KEY = 'toolspace:theme'
/** The resolved variables from the last apply, replayed before paint. */
const CACHE_KEY = 'toolspace:theme-vars'

/** The surface and text ramp. Every field is a `#rrggbb` string. */
export interface Palette {
  bg: string
  bgSoft: string
  bgInput: string
  bgElevated: string
  border: string
  borderStrong: string
  fg: string
  muted: string
  faint: string
}

export const PALETTE_KEYS: (keyof Palette)[] = [
  'bg',
  'bgSoft',
  'bgInput',
  'bgElevated',
  'border',
  'borderStrong',
  'fg',
  'muted',
  'faint',
]

export interface ThemeSpec {
  id: string
  name: string
  /** A bright accent suits a dark ramp, a deep one a light ramp. */
  dark: boolean
  palette: Palette
  accent: string
  ok?: string
  warn?: string
  danger?: string
}

export interface CustomTheme {
  name: string
  dark: boolean
  /** The preset whose ramp this custom theme starts from. */
  base: string
  palette: Partial<Palette>
  accent: string
  ok?: string
  warn?: string
  danger?: string
}

export interface ActiveTheme {
  presetId: string | null
  custom: CustomTheme | null
  dark: boolean
  name: string
  palette: Palette
  accent: string
  ok: string
  warn: string
  danger: string
}

const DARK: Palette = {
  bg: '#0b0d11',
  bgSoft: '#101319',
  bgInput: '#0d0f14',
  bgElevated: '#171b22',
  border: '#1e232b',
  borderStrong: '#2b313b',
  fg: '#e8ebf0',
  muted: '#99a3b2',
  faint: '#7e8794',
}

const LIGHT: Palette = {
  bg: '#f6f7f4',
  bgSoft: '#ffffff',
  bgInput: '#ffffff',
  bgElevated: '#ffffff',
  border: '#e3e6e0',
  borderStrong: '#c9cfc5',
  fg: '#14171b',
  muted: '#5c6360',
  faint: '#666e66',
}

/** Twelve presets: nine dark, three light. The ramp carries most of the mood. */
export const PRESETS: ThemeSpec[] = [
  {
    id: 'voltage',
    name: 'Voltage',
    dark: true,
    palette: DARK,
    accent: '#ccff4d',
    ok: '#3ddc97',
    warn: '#e6b450',
    danger: '#ff6b6b',
  },
  {
    id: 'iris',
    name: 'Iris',
    dark: true,
    palette: DARK,
    accent: '#a78bfa',
    ok: '#4ade80',
    warn: '#fbbf24',
    danger: '#fb7185',
  },
  {
    id: 'glacier',
    name: 'Glacier',
    dark: true,
    palette: DARK,
    accent: '#38e0d4',
    ok: '#4ade80',
    warn: '#fbbf24',
    danger: '#fb7185',
  },
  {
    id: 'ember',
    name: 'Ember',
    dark: true,
    palette: { ...DARK, bg: '#120d0a', bgSoft: '#1a1310', bgElevated: '#241a15', border: '#31231c', borderStrong: '#463327' },
    accent: '#ff8a4c',
    ok: '#5fd38a',
    warn: '#ffc857',
    danger: '#ff6b5e',
  },
  {
    id: 'neon',
    name: 'Neon',
    dark: true,
    palette: { ...DARK, bg: '#0d0912', bgSoft: '#150f1d', bgElevated: '#1e1630', border: '#2a1f3d', borderStrong: '#3f2f5a' },
    accent: '#ff5c9d',
    ok: '#4ade80',
    warn: '#fbbf24',
    danger: '#ff6b6b',
  },
  {
    id: 'terminal',
    name: 'Terminal',
    dark: true,
    palette: { ...DARK, bg: '#050806', bgSoft: '#0a100c', bgElevated: '#101a13', border: '#16241b', borderStrong: '#223528' },
    accent: '#43ff6b',
    ok: '#43ff6b',
    warn: '#e6ff70',
    danger: '#ff5c5c',
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    dark: true,
    palette: { ...DARK, bg: '#0d0a1f', bgSoft: '#141029', bgElevated: '#1c1638', border: '#2a2150', borderStrong: '#3d2f73' },
    accent: '#ff7edb',
    ok: '#72f1b8',
    warn: '#fede5d',
    danger: '#fe4450',
  },
  {
    id: 'moss',
    name: 'Moss',
    dark: true,
    palette: { ...DARK, bg: '#0b100d', bgSoft: '#111812', bgElevated: '#17211a', border: '#203026', borderStrong: '#2f4636' },
    accent: '#9de24f',
    ok: '#5fd38a',
    warn: '#e6c452',
    danger: '#e8705f',
  },
  {
    id: 'sandstone',
    name: 'Sandstone',
    dark: true,
    palette: { ...DARK, bg: '#12100c', bgSoft: '#1a1712', bgElevated: '#241f18', border: '#332b20', borderStrong: '#4a3d2c' },
    accent: '#e8c07d',
    ok: '#8fce9a',
    warn: '#e8c07d',
    danger: '#e88a7d',
  },
  {
    id: 'paper',
    name: 'Paper',
    dark: false,
    palette: LIGHT,
    accent: '#4f7a12',
    ok: '#1c7a4b',
    warn: '#8a6406',
    danger: '#c0362c',
  },
  {
    id: 'cobalt',
    name: 'Cobalt',
    dark: false,
    palette: LIGHT,
    accent: '#2450c8',
    ok: '#0f7a52',
    warn: '#9a6b09',
    danger: '#c0362c',
  },
  {
    id: 'blush',
    name: 'Blush',
    dark: false,
    palette: { ...LIGHT, bg: '#fbf4f4', bgSoft: '#ffffff', border: '#ecdcdc', borderStrong: '#d8bfbf' },
    accent: '#c72c62',
    ok: '#1c7a4b',
    warn: '#8a6406',
    danger: '#c0362c',
  },
]

const DEFAULT_PRESET = 'voltage'

export function presetById(id: string): ThemeSpec | undefined {
  return PRESETS.find((preset) => preset.id === id)
}

/** The ramp a custom theme inherits from when it sets no colours itself. */
export function basePalette(dark: boolean): Palette {
  return { ...(dark ? DARK : LIGHT) }
}

/** Compose a full palette: base ramp, then any custom overrides. */
export function resolvePalette(base: Palette, overrides: Partial<Palette>): Palette {
  const out = { ...base }
  for (const key of PALETTE_KEYS) {
    const value = overrides[key]
    if (typeof value === 'string' && isHex(value)) out[key] = value
  }
  return out
}

export function isHex(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value.trim())
}

/* --- reading and writing ---------------------------------------------------- */

function readStored(): { presetId?: string; custom?: CustomTheme } | null {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const value = parsed as Record<string, unknown>
    if (typeof value.presetId === 'string') return { presetId: value.presetId }
    if (typeof value.custom === 'object' && value.custom !== null) {
      const custom = value.custom as Record<string, unknown>
      if (typeof custom.accent === 'string' && isHex(custom.accent)) {
        const palette: Partial<Palette> = {}
        const rawPalette = (custom.palette ?? {}) as Record<string, unknown>
        for (const key of PALETTE_KEYS) {
          const candidate = rawPalette[key]
          if (typeof candidate === 'string' && isHex(candidate)) palette[key] = candidate
        }
        const str = (v: unknown, fallback?: string) =>
          typeof v === 'string' && isHex(v) ? v : fallback
        return {
          custom: {
            name: typeof custom.name === 'string' ? custom.name.slice(0, 40) : 'Custom',
            dark: custom.dark === true,
            base: typeof custom.base === 'string' ? custom.base : DEFAULT_PRESET,
            palette,
            accent: custom.accent,
            ok: str(custom.ok),
            warn: str(custom.warn),
            danger: str(custom.danger),
          },
        }
      }
    }
    return null
  } catch {
    return null
  }
}

/** The theme in effect, defaults included. */
export function activeTheme(): ActiveTheme {
  const stored = readStored()
  if (stored?.custom) {
    const custom = stored.custom
    const base = presetById(custom.base) ?? presetById(DEFAULT_PRESET)!
    const ramp = basePalette(custom.dark)
    return {
      presetId: null,
      custom,
      dark: custom.dark,
      name: custom.name,
      palette: resolvePalette(ramp, custom.palette),
      accent: custom.accent,
      ok: custom.ok ?? base.ok ?? '#3ddc97',
      warn: custom.warn ?? base.warn ?? '#e6b450',
      danger: custom.danger ?? base.danger ?? '#ff6b6b',
    }
  }
  const preset = presetById(stored?.presetId ?? DEFAULT_PRESET) ?? presetById(DEFAULT_PRESET)!
  return {
    presetId: preset.id,
    custom: null,
    dark: preset.dark,
    name: preset.name,
    palette: { ...preset.palette },
    accent: preset.accent,
    ok: preset.ok ?? '#3ddc97',
    warn: preset.warn ?? '#e6b450',
    danger: preset.danger ?? '#ff6b6b',
  }
}

/** A custom theme is "the preset's ramp, with these colours changed". */
export function customFrom(active: ActiveTheme, baseId: string): CustomTheme {
  const base = presetById(baseId) ?? presetById(DEFAULT_PRESET)!
  const overrides: Partial<Palette> = {}
  for (const key of PALETTE_KEYS) {
    if (active.palette[key] !== base.palette[key]) overrides[key] = active.palette[key]
  }
  return {
    name: 'My theme',
    dark: base.dark,
    base: base.id,
    palette: overrides,
    accent: active.accent,
    ok: active.ok,
    warn: active.warn,
    danger: active.danger,
  }
}

type Listener = () => void
const listeners = new Set<Listener>()

function persist(payload: object): void {
  try {
    localStorage.setItem(THEME_KEY, JSON.stringify(payload))
  } catch {
    /* private mode: the theme still applies for this session */
  }
  for (const listener of listeners) listener()
}

export function usePreset(id: string): void {
  const preset = presetById(id) ?? presetById(DEFAULT_PRESET)!
  persist({ presetId: preset.id })
}

export function useCustom(theme: CustomTheme): void {
  persist({ custom: theme })
}

/** Subscribe to theme changes, so the shell can re-render. */
export function onThemeChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Write a theme onto the document.
 *
 * Two things are derived rather than stored, to keep a theme small: the focus
 * colour is the accent nudged toward white on a dark ramp and toward black on
 * a light one, and every translucent shade is mixed from the accent in CSS.
 */
export function applyThemeToDocument(theme: ActiveTheme): void {
  const root = document.documentElement
  root.dataset.theme = theme.dark ? 'dark' : 'light'

  const { palette } = theme
  const vars: Record<string, string> = {
    '--bg': palette.bg,
    '--bg-soft': palette.bgSoft,
    '--bg-input': palette.bgInput,
    '--bg-elevated': palette.bgElevated,
    '--border': palette.border,
    '--border-strong': palette.borderStrong,
    '--fg': palette.fg,
    '--muted': palette.muted,
    '--faint': palette.faint,
    '--accent': theme.accent,
    '--accent-ink': inkFor(theme.accent),
    '--accent-strong': strongFor(theme.accent, theme.dark),
    '--ok': theme.ok,
    '--warn': theme.warn,
    '--danger': theme.danger,
  }
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value)

  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.bg)

  // Cache the resolved variables so public/theme-init.js can replay them on
  // the next visit, before paint, without duplicating the preset table there.
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ dark: theme.dark, vars }))
  } catch {
    /* private mode: the next load just picks a sane default */
  }
}

/**
 * Ink for a filled accent surface: dark on a bright accent, white on a deep
 * one. This is the only place the app reasons about colour perception, and it
 * is what keeps a button label legible whichever preset you pick.
 */
export function inkFor(accent: string): string {
  return luminance(accent) > 0.4 ? '#0b0d11' : '#ffffff'
}

/** The focus/emphasis variant: the accent a step toward the ramp's far end. */
export function strongFor(accent: string, dark: boolean): string {
  const rgb = channels(accent)
  if (!rgb) return accent
  const towards = dark ? 255 : 0
  return hex(rgb.map((c) => c + (towards - c) * 0.22) as [number, number, number])
}

export function luminance(accent: string): number {
  const rgb = channels(accent)
  if (!rgb) return 0
  const [r, g, b] = rgb.map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function channels(value: string): [number, number, number] | null {
  const hexValue = value.trim().replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(hexValue)) return null
  return [
    parseInt(hexValue.slice(0, 2), 16),
    parseInt(hexValue.slice(2, 4), 16),
    parseInt(hexValue.slice(4, 6), 16),
  ]
}

function hex(rgb: [number, number, number]): string {
  return (
    '#' +
    rgb
      .map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0'))
      .join('')
  )
}
