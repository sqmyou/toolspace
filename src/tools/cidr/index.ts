import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { computeSubnet, type SubnetInfo } from './cidr'

const tool: Tool = {
  slug: 'cidr',
  name: 'CIDR / Subnet Calculator',
  description: 'Work out network, broadcast, host range and netmask for IPv4 or IPv6 CIDR blocks.',
  category: 'Network',
  keywords: ['cidr', 'subnet', 'netmask', 'ipv4', 'ipv6', 'broadcast', 'network', 'networking'],
  render(root) {
    const input = el('input', { class: 'ts-input ts-mono', value: '192.168.1.10/24', 'aria-label': 'CIDR block' }) as HTMLInputElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const list = el('div', { class: 'ts-copy-list' })
    const quick = el('div', { class: 'ts-row ts-wrap' })

    function renderInfo(info: SubnetInfo) {
      const entries: [string, string][] = [
        ['Address', info.address],
        ['Version', `IPv${info.version}`],
        ['Prefix', `/${info.prefix}`],
        ['Network', info.network],
        ['Broadcast', info.broadcast],
        ['First host', info.first],
        ['Last host', info.last],
        ['Netmask', info.netmask],
        ['Wildcard', info.wildcard],
        ['Addresses', BigInt(info.hostCount).toLocaleString()],
        ['Scope', info.isPrivate ? 'Private / local' : 'Public'],
      ]
      list.replaceChildren(
        ...entries.map(([label, value]) =>
          el(
            'div',
            { class: 'ts-copy-row' },
            el('span', { class: 'ts-muted' }, label),
            el('code', { class: 'ts-mono ts-value' }, value),
            copyChip(() => value),
          ),
        ),
      )
    }

    function run() {
      try {
        const info = computeSubnet(input.value)
        error.hidden = true
        renderInfo(info)
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not parse this block.'
        error.hidden = false
        list.replaceChildren()
      }
    }

    input.addEventListener('input', run)

    for (const prefix of [8, 16, 24, 25, 30, 32]) {
      quick.append(
        el('button', {
          class: 'ts-button',
          type: 'button',
          onclick: () => {
            const address = input.value.split('/')[0] || '192.168.1.10'
            input.value = `${address}/${prefix}`
            run()
          },
        }, `/${prefix}`),
      )
    }

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el('div', { class: 'ts-field' }, el('label', {}, 'CIDR block'), input),
        el('div', { class: 'ts-row ts-wrap' }, el('span', { class: 'ts-muted' }, 'IPv4 presets'), quick),
        error,
        list,
        el('p', { class: 'ts-note' }, 'All subnet maths runs locally with arbitrary-precision arithmetic.'),
      ),
    )

    run()
  },
}

export default tool
