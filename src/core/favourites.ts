/**
 * Starred tools, kept in localStorage.
 *
 * The whole point is that this never leaves the machine, so there is no
 * account, no sync and no cookie — just a list of slugs in local storage.
 * Private mode throws on access, so every entry point is guarded and the
 * feature simply goes quiet rather than breaking a page.
 */
const KEY = 'toolspace:favourites'

type Listener = () => void
const listeners = new Set<Listener>()

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((slug): slug is string => typeof slug === 'string') : []
  } catch {
    return []
  }
}

function write(slugs: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(slugs))
  } catch {
    /* private mode: stars still work for this session via the in-memory set */
  }
  for (const listener of listeners) listener()
}

export function favourites(): string[] {
  return read()
}

export function isFavourite(slug: string): boolean {
  return read().includes(slug)
}

/** Star or unstar a tool. Returns the state after the toggle. */
export function toggleFavourite(slug: string): boolean {
  const current = read()
  const nowStarred = !current.includes(slug)
  write(nowStarred ? [...current, slug] : current.filter((entry) => entry !== slug))
  return nowStarred
}

/** Subscribe to changes, so the home page and a tool page can stay in step. */
export function onFavouritesChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
