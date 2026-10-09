/**
 * Small, local preferences.
 *
 * Kept in localStorage beside favourites and never sent anywhere. The only
 * preference today is whether network-backed tools are available at all: a
 * user who wants toolspace to be strictly offline can switch them off, and
 * they disappear from the index, the search and the tool pages entirely.
 */
const KEY = 'toolspace:prefs'

export interface Preferences {
  /** When false, tools that contact a third-party host are hidden. */
  networkTools: boolean
}

const DEFAULTS: Preferences = { networkTools: true }

type Listener = () => void
const listeners = new Set<Listener>()

function read(): Preferences {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULTS }
    const value = parsed as Partial<Preferences>
    return { networkTools: typeof value.networkTools === 'boolean' ? value.networkTools : DEFAULTS.networkTools }
  } catch {
    return { ...DEFAULTS }
  }
}

function write(next: Preferences): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode: the choice still applies for this session */
  }
  for (const listener of listeners) listener()
}

export function preferences(): Preferences {
  return read()
}

/** Whether tools that use the network are currently available. Defaults true. */
export function networkEnabled(): boolean {
  return read().networkTools
}

export function setNetworkEnabled(enabled: boolean): void {
  write({ ...read(), networkTools: enabled })
}

/** Subscribe to preference changes, so the shell can re-render. */
export function onPreferencesChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
