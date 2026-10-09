/**
 * Bluesky public profiles via the AT Protocol's public AppView.
 *
 * A *network* tool: it reads the *public* profile of the handle you type, so
 * it declares itself with `remote`. Parsing is pure, so it is tested without
 * the network. No sign-in, no token and no cookies are involved.
 */

const API = 'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile'

/** A Bluesky handle is DNS-like: letters, digits, dots and hyphens. */
const HANDLE_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/

/** Accept a handle, an `@handle`, or a bsky.app profile link. */
export function normalizeHandle(input: string): string | null {
  let value = input.trim().toLowerCase()
  if (value === '') return null

  const url = /^https?:\/\/(?:www\.)?bsky\.app\/profile\/([^/?#]+)/.exec(value)
  if (url) value = url[1]

  value = value.replace(/^@/, '')
  if (value.length > 253) return null
  if (!HANDLE_RE.test(value)) return null
  return value
}

export function profileUrl(handle: string): string {
  return `${API}?actor=${encodeURIComponent(handle)}`
}

export function webUrl(handle: string): string {
  return `https://bsky.app/profile/${handle}`
}

export interface BskyProfile {
  did: string
  handle: string
  displayName: string
  description: string
  avatar?: string
  banner?: string
  followers: number
  follows: number
  posts: number
}

/** Parse the AppView profile payload. Pure. */
export function parseProfile(payload: unknown): BskyProfile | null {
  if (typeof payload !== 'object' || payload === null) return null
  const data = payload as Record<string, unknown>
  if (typeof data.handle !== 'string') return null
  return {
    did: typeof data.did === 'string' ? data.did : '',
    handle: data.handle,
    displayName: typeof data.displayName === 'string' ? data.displayName : '',
    description: typeof data.description === 'string' ? data.description : '',
    avatar: typeof data.avatar === 'string' ? data.avatar : undefined,
    banner: typeof data.banner === 'string' ? data.banner : undefined,
    followers: count(data.followersCount),
    follows: count(data.followsCount),
    posts: count(data.postsCount),
  }
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Compact count, e.g. "35.2M". */
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '\u2014'
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}k`
  return String(value)
}
