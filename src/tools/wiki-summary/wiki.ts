/**
 * Wikipedia article summaries via the public REST API.
 *
 * A *network* tool: it asks en.wikipedia.org for the summary of the title you
 * type, so it declares itself with `remote`. The URL building and the response
 * parsing here are pure, so they are testable without touching the network.
 */

const API = 'https://en.wikipedia.org/api/rest_v1/page/summary'

/**
 * Turn whatever the user typed into an article title. Accepts a bare title, a
 * full article URL (any language, `/wiki/<title>`), and a URL with a fragment
 * or query. Mirrors Wikipedia's own URL rules: spaces become underscores.
 */
export function normalizeTitle(input: string): string | null {
  const value = input.trim()
  if (value === '') return null

  const url = /^https?:\/\/([a-z]{2,3})\.wikipedia\.org\/wiki\/([^#?]+)/i.exec(value)
  if (url) return decodeURIComponent(url[2]).replace(/_/g, ' ').trim() || null

  // A bare title. Reject anything with a scheme that is not a wiki link.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return null
  return value.replace(/_/g, ' ').trim() || null
}

/** The REST summary URL for a title. */
export function summaryUrl(title: string): string {
  return `${API}/${encodeURIComponent(title.replace(/ /g, '_'))}`
}

export interface WikiSummary {
  title: string
  /** The one-line description, e.g. "Programming language". */
  description: string
  /** The plain-text extract. */
  extract: string
  /** Article URL on the desktop site, if the API returned one. */
  url: string
  /** Lead image, if the article has one. */
  thumbnail?: { src: string; width: number; height: number }
  /** Disambiguation pages carry a different `type`. */
  disambiguation: boolean
  /** ISO language of the wiki that answered. */
  lang: string
}

/** Parse the REST summary payload. Pure. */
export function parseSummary(payload: unknown): WikiSummary {
  const data = (payload ?? {}) as Record<string, unknown>
  const thumb = data.thumbnail as { source?: unknown; width?: unknown; height?: unknown } | undefined
  const urls = data.content_urls as { desktop?: { page?: unknown } } | undefined
  return {
    title: typeof data.title === 'string' ? data.title : '',
    description: typeof data.description === 'string' ? data.description : '',
    extract: typeof data.extract === 'string' ? data.extract : '',
    url: typeof urls?.desktop?.page === 'string' ? urls.desktop.page : '',
    thumbnail:
      thumb && typeof thumb.source === 'string'
        ? { src: thumb.source, width: Number(thumb.width) || 0, height: Number(thumb.height) || 0 }
        : undefined,
    disambiguation: data.type === 'disambiguation',
    lang: typeof data.lang === 'string' ? data.lang : 'en',
  }
}
