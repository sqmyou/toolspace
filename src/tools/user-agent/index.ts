import {
  actions,
  button,
  copyRow,
  field,
  kvList,
  panel,
  textarea,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { parseUserAgent, SAMPLES } from './useragent'

const tool: Tool = {
  slug: 'user-agent',
  name: 'User-Agent Parser',
  description: 'Decode a user-agent string into browser, engine, OS and device type.',
  category: 'Web',
  keywords: ['user agent', 'ua', 'browser', 'detect', 'device', 'parse'],
  render(root) {
    const input = textarea({
      rows: 3,
      value: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      onInput: () => run(),
    })
    const list = kvList()

    function run() {
      const info = parseUserAgent(input.value)
      const entries: [string, string][] = [
        ['Browser', info.browser],
        ['Version', info.browserVersion || '—'],
        ['Engine', info.engine],
        ['Operating system', info.os],
        ['OS version', info.osVersion || '—'],
        ['Device', info.device],
        ['Bot', info.bot ? 'Yes' : 'No'],
      ]
      list.replaceChildren(...entries.map(([label, value]) => copyRow(label, value)))
    }

    root.append(
      toolLayout(
        {},
        panel(
          { title: 'User-Agent', icon: 'globe' },
          field(input, { label: 'User-Agent' }),
          actions(button('Use my browser’s UA', { icon: 'refresh', onClick: () => {
            input.value = typeof navigator !== 'undefined' ? navigator.userAgent : ''
            run()
          } })),
        ),
        panel(
          { title: 'Samples', icon: 'list' },
          actions(...SAMPLES.map((sample) => button(sample.label, { onClick: () => {
            input.value = sample.ua
            run()
          } }))),
        ),
        panel({ title: 'Parsed', icon: 'check' }, list),
              ),
    )

    run()
  },
}

export default tool
