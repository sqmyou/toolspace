/**
 * Recently opened tools, newest first, kept in localStorage.
 *
 * Like favourites, this is a short list of slugs and never leaves the machine.
 * It exists so the home page can offer "pick up where you left off" without an
 * account, and it can be switched off entirely in Settings.
 */
const KEY = 'toolspace:recent'
const LIMIT = 8

type Listener = () => void
const listeners = new Set<Listener>()

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((slug): slug is string => typeof slug === 'string').slice(0, LIMIT)
      : []
  } catch {
    return []
  }
}

export function recents(): string[] {
  return read()
}

/** Record a visit. The same tool never appears twice in a row. */
export function remember(slug: string): void {
  const next = [slug, ...read().filter((s) => s !== slug)].slice(0, LIMIT)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode: recents simply do not persist */
  }
  for (const listener of listeners) listener()
}

export function clearRecents(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to do */
  }
  for (const listener of listeners) listener()
}

export function onRecentsChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
