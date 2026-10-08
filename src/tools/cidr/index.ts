import {
  chips,
  copyRow,
  kvList,
  note,
  panel,
  textField,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { computeSubnet, type SubnetInfo } from './cidr'

const PREFIXES = [8, 16, 24, 25, 30, 32]

const tool: Tool = {
  slug: 'cidr',
  name: 'CIDR / Subnet Calculator',
  description: 'Work out network, broadcast, host range and netmask for IPv4 or IPv6 CIDR blocks.',
  category: 'Network',
  keywords: ['cidr', 'subnet', 'netmask', 'ipv4', 'ipv6', 'broadcast', 'network', 'networking'],
  render(root) {
    const input = textField({
      value: '192.168.1.10/24',
      mono: true,
      placeholder: '192.168.1.10/24',
      onInput: () => run(),
    })
    const error = note('', 'danger')
    error.hidden = true
    const rows = kvList()

    function run() {
      try {
        const info: SubnetInfo = computeSubnet(input.value)
        error.hidden = true
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
        rows.replaceChildren(...entries.map(([label, value]) => copyRow(label, value)))
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not parse this block.'
        error.hidden = false
        rows.replaceChildren()
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Block', icon: 'globe' },
          input,
          chips(PREFIXES.map((prefix) => ({
            label: `/${prefix}`,
            onClick: (value) => {
              const address = input.value.split('/')[0] || '192.168.1.10'
              input.value = `${address}${value}`
              run()
            },
          }))),
          error,
        ),
        panel({ title: 'Breakdown', icon: 'layers' }, rows),
        note('All subnet maths runs locally with arbitrary-precision arithmetic.'),
      ),
    )

    run()
  },
}

export default tool
