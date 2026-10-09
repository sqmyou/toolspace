/**
 * A small, hand-drawn icon set.
 *
 * Icons are plain SVG strings rather than a component library, so a tool can
 * drop one into any element without adding a dependency. They share a single
 * grid (24×24), a single stroke weight and round caps, which is what makes a
 * set read as one family instead of a pile of borrowed glyphs.
 *
 * `icon()` returns an inline `<svg>` string. Use it where a tool already sets
 * `innerHTML`; use `iconEl()` when it builds DOM with `el()`.
 */
const svg = (body: string, size = 16): string =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" ` +
  `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

export const ICONS: Record<string, string> = {
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.4"/><path d="M15 9V6.4A2.4 2.4 0 0 0 12.6 4H6.4A2.4 2.4 0 0 0 4 6.4v6.2A2.4 2.4 0 0 0 6.4 15H9"/>',
  check: '<path d="M4.5 12.6 9.4 17.5 19.5 6.8"/>',
  download: '<path d="M12 3.8v11.4"/><path d="m7.4 10.6 4.6 4.6 4.6-4.6"/><path d="M4.6 19.4h14.8"/>',
  upload: '<path d="M12 20.2V8.8"/><path d="m7.4 13.4 4.6-4.6 4.6 4.6"/><path d="M4.6 4.6h14.8"/>',
  play: '<path d="M7.5 5.4v13.2L19 12z"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4.6V10h-5.4"/>',
  search: '<circle cx="11" cy="11" r="6.2"/><path d="m19.5 19.5-3.9-3.9"/>',
  close: '<path d="M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6"/>',
  chevron: '<path d="m9 5.5 6.5 6.5L9 18.5"/>',
  plus: '<path d="M12 5.2v13.6M5.2 12h13.6"/>',
  minus: '<path d="M5.2 12h13.6"/>',
  arrowUp: '<path d="M12 19.4V5.4"/><path d="m6.4 11 5.6-5.6 5.6 5.6"/>',
  arrowDown: '<path d="M12 4.6v14"/><path d="m6.4 13 5.6 5.6 5.6-5.6"/>',
  arrowLeft: '<path d="M19.4 12H5.4"/><path d="m11 6.4-5.6 5.6 5.6 5.6"/>',
  star: '<path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z"/>',
  file: '<path d="M13.5 3.5H7.4A2.4 2.4 0 0 0 5 5.9v12.2a2.4 2.4 0 0 0 2.4 2.4h9.2a2.4 2.4 0 0 0 2.4-2.4V9z"/><path d="M13.5 3.5V9H19"/>',
  image: '<rect x="3.6" y="4.6" width="16.8" height="14.8" rx="2.4"/><circle cx="9" cy="10" r="1.6"/><path d="m5 17 4.6-4.6L13 15.8l2.6-2.6 3.8 3.8"/>',
  uploadCloud: '<path d="M7 18.5a4 4 0 0 1-.3-8 5.5 5.5 0 0 1 10.5 1.6 3.6 3.6 0 0 1-.7 6.4"/><path d="M12 20.5v-8.4"/><path d="m8.8 15.3 3.2-3.2 3.2 3.2"/>',
  sliders: '<path d="M4.5 8.2h6M14.5 8.2h5M4.5 15.8h3M11.5 15.8h8"/><circle cx="12.5" cy="8.2" r="2"/><circle cx="9.5" cy="15.8" r="2"/>',
  info: '<circle cx="12" cy="12" r="8.4"/><path d="M12 11v5.2"/><path d="M12 7.8h.01"/>',
  shield: '<path d="M12 3.6 5.4 6.2v5.1c0 4 2.8 7.6 6.6 9.1 3.8-1.5 6.6-5.1 6.6-9.1V6.2z"/>',
  lock: '<rect x="5" y="10.4" width="14" height="9.6" rx="2.2"/><path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6"/>',
  key: '<circle cx="8" cy="15.5" r="3.6"/><path d="m10.6 13 8.2-8.2"/><path d="m16 7.6 2.2 2.2"/><path d="m18.4 5.2 2 2"/>',
  hash: '<path d="M9.4 4.5 7.6 19.5M16.4 4.5l-1.8 15M5 9.2h14M4.6 14.8h14"/>',
  clock: '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3 1.9"/>',
  calendar: '<rect x="4" y="5.6" width="16" height="14.4" rx="2.2"/><path d="M4 9.8h16M8.4 3.6v3.4M15.6 3.6v3.4"/>',
  code: '<path d="m8.6 8.4-4 3.6 4 3.6"/><path d="m15.4 8.4 4 3.6-4 3.6"/><path d="m13.4 5.6-2.8 12.8"/>',
  braces: '<path d="M9.4 4.4C6.9 4.4 7.6 10 5.2 10.6c2.4.6 1.7 6.2 4.2 6.2"/><path d="M14.6 4.4c2.5 0 1.8 5.6 4.2 6.2-2.4.6-1.7 6.2-4.2 6.2"/>',
  text: '<path d="M5.5 6.4h13M5.5 12h9.5M5.5 17.6h11"/>',
  swap: '<path d="M7.2 8.4h11.2"/><path d="m14.8 4.8 3.6 3.6-3.6 3.6"/><path d="M16.8 15.6H5.6"/><path d="m9.2 12 3.6 3.6-3.6 3.6"/>',
  eye: '<path d="M2.8 12S6.4 6.4 12 6.4 21.2 12 21.2 12 17.6 17.6 12 17.6 2.8 12 2.8 12Z"/><circle cx="12" cy="12" r="2.7"/>',
  ruler: '<rect x="3.4" y="8.6" width="17.2" height="6.8" rx="1.6"/><path d="M7.6 8.6v2.6M11.6 8.6v3.4M15.6 8.6v2.6"/>',
  eraser: '<path d="m8 17.6-3.2-3.2a2 2 0 0 1 0-2.8l6.4-6.4a2 2 0 0 1 2.8 0l3.6 3.6a2 2 0 0 1 0 2.8L12 17.6z"/><path d="M8 17.6h10.6"/><path d="m9.4 8.6 6 6"/>',
  palette: '<path d="M12 3.6a8.4 8.4 0 0 0 0 16.8c1.4 0 2-1 2-1.9 0-.5-.2-.9-.5-1.2-.3-.4-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6h1.5a4.3 4.3 0 0 0 4.3-4.3C20.4 6.6 16.6 3.6 12 3.6Z"/><circle cx="7.6" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="9.6" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="14" cy="7.4" r="1.1" fill="currentColor" stroke="none"/>',
  type: '<path d="M5.4 7V5.4h13.2V7"/><path d="M12 5.4v13.2"/><path d="M9 18.6h6"/>',
  external: '<path d="M13.6 5.4h5v5"/><path d="M18.6 5.4 11 13"/><path d="M17 13.4v4.2a1.9 1.9 0 0 1-1.9 1.9H6.8a1.9 1.9 0 0 1-1.9-1.9V9.3a1.9 1.9 0 0 1 1.9-1.9h4.2"/>',
  sparkle: '<path d="M12 4.2 13.6 9 18.4 10.6 13.6 12.2 12 17 10.4 12.2 5.6 10.6 10.4 9z"/><path d="M18.4 16.4l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/>',
  globe: '<circle cx="12" cy="12" r="8.4"/><path d="M3.8 12h16.4"/><path d="M12 3.6c2.2 2.4 3.3 5.3 3.3 8.4S14.2 18 12 20.4C9.8 18 8.7 15.1 8.7 12S9.8 6 12 3.6Z"/>',
  wand: '<path d="m5.5 18.5 9-9"/><path d="m13.2 6.8 2 2"/><path d="M18.5 4.5v3M17 6h3M6.5 4.5v2M5.5 5.5h2M19 12.5v2M18 13.5h2"/>',
  layers: '<path d="m12 3.8 8 4.2-8 4.2-8-4.2z"/><path d="m4 12.4 8 4.2 8-4.2"/><path d="m4 16.4 8 4.2 8-4.2"/>',
  filter: '<path d="M4.5 6.2h15"/><path d="M7 12h10"/><path d="M10 17.8h4"/>',
  bolt: '<path d="M13.4 3.6 5.8 13h5l-1.2 7.4 7.6-9.4h-5z"/>',
  key2: '<circle cx="7.4" cy="16.6" r="3"/><path d="m9.6 14.4 8.4-8.4"/><path d="m15 9 2 2"/>',
  chart: '<path d="M4.6 19.4h14.8"/><path d="M8 19.4v-6.2M12 19.4V8M16 19.4v-4"/>',
  columns: '<rect x="3.8" y="4.6" width="7" height="14.8" rx="1.8"/><rect x="13.2" y="4.6" width="7" height="14.8" rx="1.8"/>',
}

export type IconName = keyof typeof ICONS

/** An icon as an inline SVG string, sized in pixels. */
export function icon(name: IconName | string, size = 16): string {
  return svg(ICONS[name] ?? ICONS.info, size)
}

/** An icon wrapped in a `<span>` element, for use with `el()`. */
export function iconEl(name: IconName | string, size = 16): HTMLElement {
  const span = document.createElement('span')
  span.className = 'ts-ic'
  span.setAttribute('aria-hidden', 'true')
  span.innerHTML = icon(name, size)
  return span
}
