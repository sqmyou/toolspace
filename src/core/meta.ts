/**
 * Per-route document metadata.
 *
 * The app is a hash-router SPA, so the shell's static <title>/description are
 * all a crawler ever sees. Setting them on every route change at least makes
 * the browser tab, history entry, bookmark and screen-reader announcement
 * truthful, and gives any crawler that does run JS the right values too.
 *
 * No new tags are invented: `setMeta` updates the existing tag when there is
 * one and creates it when there is not, so the static head stays the fallback.
 */

/** One place to build absolute URLs, so a canonical is never relative. */
export const SITE_ORIGIN = 'https://toolspace.sirsamyoudev.workers.dev'

/** The site name used as the title suffix. */
const BRAND = 'toolspace'

/** The fallback description, matching the static head in index.html. */
export const SITE_DESCRIPTION =
  'A hundred-odd small tools for text, data, images and code. No account, no tracking, no ads — and nothing you paste is ever uploaded, because there is no server to send it to.'

/** A single-line title: `Name — toolspace`, or the brand alone for home. */
export function pageTitle(name?: string): string {
  return name ? `${name} — ${BRAND}` : BRAND
}

/** The absolute URL for a hash route: `/` maps to the bare origin. */
export function canonicalUrl(path = '/'): string {
  return `${SITE_ORIGIN}/${path === '/' ? '' : `#${path}`}`
}

/** Find a <meta> by name or property, or add it to <head>. */
function metaTag(attr: 'name' | 'property', key: string): HTMLMetaElement {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attr, key)
    document.head.append(tag)
  }
  return tag
}

export function setMeta(attr: 'name' | 'property', key: string, content: string): void {
  metaTag(attr, key).content = content
}

function linkRel(rel: string): HTMLLinkElement {
  let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!link) {
    link = document.createElement('link')
    link.rel = rel
    document.head.append(link)
  }
  return link
}

export interface PageMeta {
  /** Without the brand suffix — this module adds it. */
  title?: string
  description?: string
  /** Route path after the `#`, e.g. `/jwt-decoder`, for the canonical URL. */
  path?: string
}

/** Apply a route's title, description and canonical URL in one call. */
export function applyMeta({ title, description, path = '/' }: PageMeta): void {
  const desc = description ?? SITE_DESCRIPTION
  document.title = pageTitle(title)
  const canonical = canonicalUrl(path)
  linkRel('canonical').href = canonical
  setMeta('property', 'og:url', canonical)
  setMeta('property', 'og:title', pageTitle(title))
  setMeta('name', 'twitter:title', pageTitle(title))
  setMeta('name', 'description', desc)
  setMeta('property', 'og:description', desc)
  setMeta('name', 'twitter:description', desc)
}
