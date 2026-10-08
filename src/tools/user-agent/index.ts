import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { parseUserAgent, SAMPLES } from './useragent'

const tool: Tool = {
  slug: 'user-agent',
  name: 'User-Agent Parser',
  description: 'Decode a user-agent string into browser, engine, OS and device type.',
  category: 'Web',
  keywords: ['user agent', 'ua', 'browser', 'detect', 'device', 'parse'],
  render(root) {
    const input = el('textarea', {
      class: 'ts-textarea ts-mono',
      rows: 3,
      value: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      'aria-label': 'User-Agent string',
    }) as HTMLTextAreaElement

    const list = el('div', { class: 'ts-copy-list' })

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
      list.replaceChildren(
        ...entries.map(([label, value]) =>
          el(
            'div',
            { class: 'ts-copy-row' },
            el('span', { class: 'ts-muted' }, label),
            el('span', { class: 'ts-value' }, value),
            copyChip(() => value),
          ),
        ),
      )
    }

    input.addEventListener('input', run)

    const samples = el('div', { class: 'ts-row ts-wrap' })
    for (const sample of SAMPLES) {
      samples.append(
        el('button', {
          class: 'ts-button',
          type: 'button',
          onclick: () => {
            input.value = sample.ua
            run()
          },
        }, sample.label),
      )
    }

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el('div', { class: 'ts-row ts-wrap' }, el('button', {
          class: 'ts-button',
          type: 'button',
          onclick: () => {
            input.value = typeof navigator !== 'undefined' ? navigator.userAgent : ''
            run()
          },
        }, 'Use my browser’s UA')),
        el('div', { class: 'ts-field' }, el('label', {}, 'User-Agent'), input),
        el('h3', { class: 'ts-subhead' }, 'Samples'),
        samples,
        el('h3', { class: 'ts-subhead' }, 'Parsed'),
        list,
        el('p', { class: 'ts-note' }, 'Parsing is heuristic and runs locally; nothing is sent anywhere.'),
      ),
    )

    run()
  },
}

export default tool
