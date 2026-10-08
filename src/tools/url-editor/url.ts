/** Percent-encoding helpers and query-string parsing/building. */

export interface QueryParam {
  key: string
  value: string
}

export function encodeComponent(text: string): string {
  return encodeURIComponent(text)
}

export function decodeComponent(text: string): string {
  return decodeURIComponent(text)
}

export function encodeUrl(text: string): string {
  return encodeURI(text)
}

export function decodeUrl(text: string): string {
  // Tolerate a malformed percent sequence rather than throwing.
  try {
    return decodeURI(text)
  } catch {
    return text.replace(/%[0-9a-f]{2}/gi, (m) => {
      try {
        return decodeURI(m)
      } catch {
        return m
      }
    })
  }
}

export interface ParsedUrl {
  base: string
  params: QueryParam[]
  hash: string
}

/**
 * Split an arbitrary URL-or-path into base, ordered params and hash. Repeated
 * keys are preserved; blank keys are ignored.
 */
export function parseUrl(input: string): ParsedUrl {
  const hashAt = input.indexOf('#')
  const hash = hashAt >= 0 ? input.slice(hashAt + 1) : ''
  const rest = hashAt >= 0 ? input.slice(0, hashAt) : input

  const queryAt = rest.indexOf('?')
  const base = queryAt >= 0 ? rest.slice(0, queryAt) : rest
  const query = queryAt >= 0 ? rest.slice(queryAt + 1) : ''

  const params: QueryParam[] = []
  if (query) {
    for (const pair of query.split('&')) {
      if (!pair) continue
      const eq = pair.indexOf('=')
      const rawKey = eq >= 0 ? pair.slice(0, eq) : pair
      const rawValue = eq >= 0 ? pair.slice(eq + 1) : ''
      const key = safeDecode(rawKey)
      if (!key) continue
      params.push({ key, value: safeDecode(rawValue) })
    }
  }

  return { base, params, hash }
}

function safeDecode(value: string): string {
  return value.replace(/\+/g, ' ').replace(/%[0-9a-f]{2}/gi, (m) => {
    try {
      return decodeURIComponent(m)
    } catch {
      return m
    }
  })
}

export interface BuildOptions {
  encode: boolean
  sort: boolean
}

export function buildUrl(base: string, params: QueryParam[], hash: string, options: BuildOptions): string {
  let list = params.filter((p) => p.key.trim().length > 0)
  if (options.sort) list = [...list].sort((a, b) => a.key.localeCompare(b.key))

  const query = list
    .map((p) => {
      const key = options.encode ? encodeURIComponent(p.key) : p.key
      const value = options.encode ? encodeURIComponent(p.value) : p.value
      return value ? `${key}=${value}` : key
    })
    .join('&')

  let result = base
  if (query) result += `?${query}`
  if (hash) result += `#${hash}`
  return result
}
