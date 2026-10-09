/**
 * Steam app-id parsing and store-artwork URL construction.
 *
 * No network calls happen here. Steam's image CDN serves artwork at a stable,
 * predictable path — `/steam/apps/<appid>/<file>` on
 * `cdn.cloudflare.steamstatic.com` — so the URL can be built locally from the
 * app id alone, with no API key and nothing about the user sent anywhere but
 * the image request itself.
 */

/** Steam app ids are decimal and comfortably fit in ten digits. */
const APP_ID_RE = /^\d{1,10}$/

/**
 * Pull the app id out of anything a user is likely to paste: a bare number, a
 * store URL (with or without a slug and trailing query), a community link, or
 * a loose "app 570" phrase.
 */
export function parseAppId(input: string): string | null {
  const value = input.trim()
  if (value === '') return null

  if (APP_ID_RE.test(value)) return value

  const url = /(?:store\.steampowered\.com|steamcommunity\.com|steamdb\.info)\/(?:app|apps)\/(\d{1,10})/i.exec(
    value,
  )
  if (url) return url[1]

  // A short phrase like "app 570" — only when there is no URL to misread.
  if (value.length <= 24) {
    const loose = /\b(\d{1,10})\b/.exec(value)
    if (loose) return loose[1]
  }

  return null
}

/** The public store page for an app. */
export function appUrl(id: string): string {
  return `https://store.steampowered.com/app/${id}/`
}

export interface SteamAsset {
  /** Filename on the CDN. */
  name: string
  label: string
  width: number
  height: number
  note: string
}

/**
 * The artwork files Steam serves for (nearly) every app. Not every app has
 * every file — an unreleased or delisted game may be missing its hero, say —
 * so the tool probes each one and falls back to whichever actually loads.
 */
export const ASSETS: SteamAsset[] = [
  { name: 'header.jpg', label: 'Header', width: 460, height: 215, note: 'The wide banner at the top of the store page' },
  { name: 'capsule_616x353.jpg', label: 'Capsule', width: 616, height: 353, note: 'The tile on store grids and search results' },
  { name: 'library_600x900.jpg', label: 'Library art', width: 600, height: 900, note: 'Portrait cover used in the library shelf' },
  { name: 'library_hero.jpg', label: 'Hero', width: 1920, height: 620, note: 'The wide banner behind a library page' },
]

/** The filenames of every artwork file, in the order shown in the picker. */
export const ARTWORK_FILENAMES = ASSETS.map((asset) => asset.name)

/** Build the CDN URL for one artwork file. */
export function imageUrl(id: string, asset: string): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/${asset}`
}

/** The filename a downloaded image gets, so two sizes do not collide. */
export function artworkFilename(id: string, asset: string): string {
  return `steam-${id}-${asset}`
}

export function assetByName(name: string): SteamAsset | undefined {
  return ASSETS.find((asset) => asset.name === name)
}
