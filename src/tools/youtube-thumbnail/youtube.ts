/**
 * YouTube video-id parsing and thumbnail URL construction.
 *
 * No network calls happen here — a thumbnail is just a URL, and YouTube has
 * published the same `/vi/<id>/<name>.jpg` shape on `i.ytimg.com` for years.
 * Building the URL locally means the tool works without an API key and
 * without sending the user's links anywhere.
 */

/** Every YouTube id is exactly this: 11 characters of the base64url alphabet. */
const ID_RE = /^[A-Za-z0-9_-]{11}$/

export interface ThumbnailQuality {
  /** Filename stem on i.ytimg.com. */
  name: string
  label: string
  width: number
  height: number
  aspect: '16:9' | '4:3'
  note: string
}

/**
 * The sizes YouTube serves. `maxresdefault` and `mqdefault` are true 16:9;
 * the older names are 4:3 and carry black bars on a widescreen video, which is
 * why both shapes are offered.
 *
 * The 120x90 `default` size is deliberately left out: it is the exact size of
 * YouTube's own placeholder, so it cannot be told apart from a missing image,
 * and nobody wants a 120x90 file when `hqdefault` always exists.
 */
export const QUALITIES: ThumbnailQuality[] = [
  { name: 'maxresdefault', label: 'Max resolution', width: 1280, height: 720, aspect: '16:9', note: 'Best quality, when the uploader provided it' },
  { name: 'hq720', label: 'HD 720', width: 1280, height: 720, aspect: '16:9', note: 'Alias of max resolution on most videos' },
  { name: 'sddefault', label: 'Standard', width: 640, height: 480, aspect: '4:3', note: 'Often missing on newer uploads; padded to 4:3' },
  { name: 'hqdefault', label: 'High quality', width: 480, height: 360, aspect: '4:3', note: 'Always present; padded to 4:3 with black bars' },
  { name: 'mqdefault', label: 'Medium', width: 320, height: 180, aspect: '16:9', note: 'True widescreen, small file' },
]

/**
 * Pull the video id out of anything a user is likely to paste: a watch URL,
 * a short link, a Short, an embed, a live URL, a bare id, or a URL with
 * tracking parameters attached.
 */
export function parseVideoId(input: string): string | null {
  const value = input.trim()
  if (value === '') return null

  // A bare id, with or without surrounding whitespace.
  if (ID_RE.test(value)) return value

  // Strip the scheme so `https://` and `youtube.com/...` look alike.
  const withoutScheme = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')

  // Query form first: ?v=<id>, wherever it sits.
  const queryForm = /[?&]v=([A-Za-z0-9_-]{11})(?:[&#]|$)/.exec(withoutScheme)
  if (queryForm) return queryForm[1]

  // Short link: youtu.be/<id>.
  const shortForm = /^youtu\.be\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/.exec(withoutScheme)
  if (shortForm) return shortForm[1]

  // Path forms: /shorts/<id>, /embed/<id>, /live/<id>, /v/<id>.
  const pathForm = /(?:^|\/)(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/.exec(withoutScheme)
  if (pathForm) return pathForm[1]

  // A bare id used as the whole path: youtube.com/<id>.
  const barePath = /^[^/]*youtube\.[a-z.]+\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/i.exec(withoutScheme)
  if (barePath) return barePath[1]

  // Last resort: an 11-character id sitting on its own.
  const loose = /(?:^|[^A-Za-z0-9_-])([A-Za-z0-9_-]{11})(?:$|[^A-Za-z0-9_-])/.exec(value)
  return loose ? loose[1] : null
}

export function thumbnailUrl(id: string, quality: string): string {
  return `https://i.ytimg.com/vi/${id}/${quality}.jpg`
}

export function watchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`
}

export function shortUrl(id: string): string {
  return `https://youtu.be/${id}`
}

export interface Thumbnail extends ThumbnailQuality {
  url: string
}

export function thumbnailsFor(id: string): Thumbnail[] {
  return QUALITIES.map((quality) => ({ ...quality, url: thumbnailUrl(id, quality.name) }))
}

/** Look up a size by its filename stem. */
export function qualityByName(name: string): ThumbnailQuality | undefined {
  return QUALITIES.find((quality) => quality.name === name)
}

/**
 * The best size that actually exists. QUALITIES is ordered best-first, so this
 * is the first one marked available. Used to move the user off a size the video
 * does not have, rather than leaving them looking at a placeholder.
 */
export function bestAvailable(available: Record<string, boolean>): string {
  const hit = QUALITIES.find((quality) => available[quality.name])
  return (hit ?? QUALITIES[0]).name
}

/**
 * YouTube answers a request for a missing size with HTTP 404 *and* a real
 * 120x90 JPEG of its own placeholder, so `img.onerror` never fires. The only
 * signal available in the browser is the decoded size, so anything at or
 * below the placeholder's dimensions is treated as missing.
 */
export function isPlaceholder(width: number, height: number): boolean {
  return width <= 120 && height <= 90
}

/** A filename that will not collide in a downloads folder. */
export function thumbnailFilename(id: string, quality: string): string {
  return `${id}-${quality}.jpg`
}
