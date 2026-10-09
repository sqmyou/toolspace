/**
 * DNS lookup via Google's public resolver (dns.google/resolve).
 *
 * This is a *network* tool: it sends the name you type to Google, so the tool
 * declares itself with `remote` and the shell marks it everywhere. The parsing
 * here is pure and takes the raw JSON, so it is testable without the network.
 */

export type RecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'NS' | 'TXT' | 'SRV' | 'CAA' | 'SOA' | 'PTR'

/** DNS type codes, used because the JSON answer carries numeric types. */
const TYPE_NAMES: Record<number, string> = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  6: 'SOA',
  12: 'PTR',
  15: 'MX',
  16: 'TXT',
  28: 'AAAA',
  33: 'SRV',
  257: 'CAA',
}

/** RCODE values that are worth naming, since they are what users actually hit. */
const RCODES: Record<number, string> = {
  0: 'NOERROR',
  1: 'FORMERR',
  2: 'SERVFAIL',
  3: 'NXDOMAIN',
  5: 'REFUSED',
}

export interface DnsAnswer {
  name: string
  type: string
  ttl: number
  data: string
}

export interface DnsResult {
  /** True when the resolver answered with NOERROR. */
  ok: boolean
  /** RCODE name, e.g. NXDOMAIN, or a synthesised label on a transport failure. */
  status: string
  answers: DnsAnswer[]
  /** Set when the resolver itself returned an error we can name. */
  message?: string
}

/**
 * A domain to look up. Rejects anything that is obviously not a hostname, so
 * we never forward a value that would need escaping.
 */
export function normalizeDomain(input: string): string {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) throw new Error('Enter a domain name to look up.')
  // Strip a scheme and any path, so pasting a URL still works.
  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
  const host = withoutScheme.split(/[/?#]/)[0].replace(/\.$/, '')
  if (host.length > 253) throw new Error('That name is longer than a DNS name can be.')
  if (!/^[a-z0-9._-]+$/.test(host)) throw new Error('A domain name can only contain letters, digits, dots and hyphens.')
  if (/^[-.]|[-.]$|\.\./.test(host)) throw new Error('That is not a valid domain name.')
  return host
}

/** Parse the resolver's JSON into the shape the UI renders. Pure. */
export function parseDnsResponse(payload: unknown): DnsResult {
  if (typeof payload !== 'object' || payload === null) {
    return { ok: false, status: 'Malformed', answers: [], message: 'The resolver returned something unexpected.' }
  }
  const data = payload as { Status?: number; Answer?: unknown[]; Comment?: unknown }
  const status = RCODES[data.Status ?? -1] ?? `RCODE ${data.Status}`
  const ok = data.Status === 0

  const answers: DnsAnswer[] = []
  if (Array.isArray(data.Answer)) {
    for (const entry of data.Answer) {
      if (typeof entry !== 'object' || entry === null) continue
      const record = entry as { name?: unknown; type?: unknown; TTL?: unknown; data?: unknown }
      answers.push({
        name: typeof record.name === 'string' ? record.name : '',
        type: TYPE_NAMES[Number(record.type)] ?? `TYPE${record.type}`,
        ttl: typeof record.TTL === 'number' ? record.TTL : 0,
        data: typeof record.data === 'string' ? record.data : String(record.data ?? ''),
      })
    }
  }

  const message =
    !ok && data.Status === 3 && typeof data.Comment !== 'string'
      ? 'The name does not exist.'
      : !ok && typeof data.Comment === 'string'
        ? data.Comment
        : undefined

  return { ok, status, answers, message }
}

/** The resolver URL for a name and type. Uses the JSON API, not the DoH wire format. */
export function dnsQueryUrl(domain: string, type: RecordType): string {
  return `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`
}
