import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { breakdown, formatBytes, parseBytes } from './bytes'

const tool: Tool = {
  slug: 'byte-size',
  name: 'Byte Size Converter',
  description: 'Convert between bytes, decimal kB/MB and binary KiB/MiB, with both scales side by side.',
  category: 'Numbers',
  keywords: ['bytes', 'size', 'kb', 'mb', 'kib', 'mib', 'storage', 'convert', 'human readable'],
  render(root) {
    const input = el('input', { class: 'ts-input ts-mono', value: '1.5 MB', 'aria-label': 'Size' }) as HTMLInputElement
    const binary = el('input', { type: 'checkbox' }) as HTMLInputElement
    const decimals = el('input', { class: 'ts-input ts-mono', type: 'number', min: '0', max: '10', value: '2' }) as HTMLInputElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const rows = el('div', { class: 'ts-bytes-list' })
    const main = el('code', { class: 'ts-bytes-main' })
    let formatted = ''

    function run() {
      rows.replaceChildren()
      try {
        const parsed = parseBytes(input.value)
        formatted = formatBytes(parsed.bytes, { binary: binary.checked, decimals: Number(decimals.value) })
        main.textContent = formatted
        error.hidden = true
        for (const row of breakdown(parsed.bytes)) {
          rows.append(
            el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, row.label), el('code', { class: 'ts-bytes-value' }, row.value), copyChip(row.value, 'Copy')),
          )
        }
      } catch (err) {
        formatted = ''
        main.textContent = ''
        error.textContent = err instanceof Error ? err.message : 'Could not read that size.'
        error.hidden = false
      }
    }

    input.addEventListener('input', run)
    binary.addEventListener('change', run)
    decimals.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field ts-grow' }, el('label', {}, 'Size'), input),
          el('label', { class: 'ts-inline-field' }, binary, 'Binary units (1024)'),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Decimals'), decimals),
        ),
        error,
        el('div', { class: 'ts-row ts-between' }, main, copyChip(() => formatted, 'Copy')),
        rows,
        el('p', { class: 'ts-note' }, 'Decimal units use powers of 1000, binary units powers of 1024. Try "1 GB" and compare the two rows.'),
      ),
    )

    run()
  },
}

export default tool
