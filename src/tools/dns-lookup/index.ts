import {
  actions,
  badge,
  button,
  copyRow,
  note,
  panel,
  segmented,
  stat,
  stats,
  table,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { dnsQueryUrl, normalizeDomain, parseDnsResponse, type DnsResult, type RecordType } from './dns'

const TYPES: RecordType[] = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SRV', 'CAA', 'SOA']

const tool: Tool = {
  slug: 'dns-lookup',
  name: 'DNS Lookup',
  description: 'Resolve A, MX, TXT and other records for any domain, with TTLs and a plain-language status.',
  category: 'Web',
  keywords: ['dns', 'domain', 'resolve', 'dig', 'nslookup', 'mx', 'txt', 'a record', 'nameserver', 'record'],
  remote: {
    host: 'dns.google',
    note: 'It asks Google’s public DNS resolver (dns.google) for the records of the domain you type. The domain name leaves your browser; nothing else does, and no cookies are sent.',
  },
  render(root) {
    const input = textField({ value: 'example.com', placeholder: 'example.com', onInput: () => queue() })
    input.spellcheck = false
    input.setAttribute('aria-label', 'Domain name to look up')

    let currentType: RecordType = 'A'
    const type = segmented({
      label: 'Record type',
      value: currentType,
      items: TYPES.map((value) => ({ value, label: value })),
      onChange: (value) => {
        currentType = value as RecordType
        queue()
      },
    })

    const status = el('div', { class: 'ts-k-actions' })
    const summary = stats()
    summary.hidden = true
    const results = el('div', {})
    const detail = el('div', { class: 'ts-k-kvlist' })

    let seq = 0
    let timer: number | undefined

    /** Debounce, so typing a domain does not fire a request per keystroke. */
    function queue() {
      window.clearTimeout(timer)
      timer = window.setTimeout(lookUp, 450)
    }

    async function lookUp() {
      const current = ++seq
      let domain: string
      try {
        domain = normalizeDomain(input.value)
      } catch (err) {
        status.replaceChildren(badge(err instanceof Error ? err.message : 'Enter a domain.', 'warn'))
        summary.hidden = true
        results.replaceChildren()
        detail.replaceChildren()
        return
      }

      status.replaceChildren(badge(`Looking up ${domain}…`, 'neutral'))
      try {
        const response = await fetch(dnsQueryUrl(domain, currentType), {
          headers: { accept: 'application/dns-json' },
        })
        if (current !== seq) return
        if (!response.ok) {
          status.replaceChildren(badge(`The resolver returned HTTP ${response.status}.`, 'danger'))
          return
        }
        const parsed = parseDnsResponse(await response.json())
        if (current !== seq) return
        paint(domain, parsed)
      } catch {
        if (current !== seq) return
        status.replaceChildren(badge('Could not reach the resolver. Check your connection and try again.', 'danger'))
        summary.hidden = true
        results.replaceChildren()
        detail.replaceChildren()
      }
    }

    function paint(domain: string, result: DnsResult) {
      const tone = result.ok ? 'ok' : 'danger'
      status.replaceChildren(
        badge(result.ok ? `${result.status} · ${result.answers.length} record${result.answers.length === 1 ? '' : 's'}` : result.status, tone),
      )

      summary.replaceChildren(
        stat({ label: 'status', value: result.status }),
        stat({ label: 'records', value: String(result.answers.length) }),
        stat({ label: 'type', value: currentType }),
      )
      summary.hidden = false

      if (result.answers.length === 0) {
        results.replaceChildren(note(result.message ?? 'No records of this type were returned.', result.ok ? 'neutral' : 'danger'))
        detail.replaceChildren()
      } else {
        results.replaceChildren(
          table(
            [
              { key: 'name', label: 'Name', mono: true },
              { key: 'type', label: 'Type' },
              { key: 'ttl', label: 'TTL', mono: true },
              { key: 'data', label: 'Value', mono: true },
            ],
            result.answers.map((answer) => ({
              name: answer.name,
              type: answer.type,
              ttl: `${answer.ttl}s`,
              data: answer.data,
            })),
          ),
        )
      }

      detail.replaceChildren(
        copyRow('Query', `${domain} ${currentType}`),
        copyRow('Resolver', 'dns.google'),
      )
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Lookup', icon: 'globe' },
          el('div', { class: 'ts-k-split' }, input, type),
          status,
          summary,
          actions(button('Look up', { icon: 'search', variant: 'primary', onClick: lookUp })),
          note('This tool uses the network. Only the domain you type is sent, to Google’s public resolver. Everything else stays on this page.'),
        ),
        panel({ title: 'Answers', icon: 'columns' }, results),
        panel({ title: 'Query', icon: 'info' }, detail),
      ),
    )

    void lookUp()
  },
}

export default tool
