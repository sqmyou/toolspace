import {
  actions,
  checkbox,
  copyRow,
  field,
  kvList,
  note,
  outputBlock,
  panel,
  textField,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { breakdown, formatBytes, parseBytes } from './bytes'

const tool: Tool = {
  slug: 'byte-size',
  name: 'Byte Size Converter',
  description: 'Convert between bytes, decimal kB/MB and binary KiB/MiB, with both scales side by side.',
  category: 'Numbers',
  keywords: ['bytes', 'size', 'kb', 'mb', 'kib', 'mib', 'storage', 'convert', 'human readable'],
  render(root) {
    const input = textField({
      value: '1.5 MB',
      mono: true,
      placeholder: 'e.g. 1.5 MB',
      onInput: () => run(),
    })
    const decimals = textField({ type: 'number', value: '2', mono: true, onInput: () => run() })
    let binary = false

    const error = note('', 'danger')
    error.hidden = true
    const summary = outputBlock('', { label: 'Formatted', copy: () => formatted })
    const rows = kvList()
    let formatted = ''

    function run() {
      try {
        const parsed = parseBytes(input.value)
        formatted = formatBytes(parsed.bytes, { binary, decimals: Number(decimals.value) })
        summary.body.replaceChildren(formatted)
        summary.setMeta(parsed.bytes.toLocaleString('en-US'))
        summary.setLabel('Formatted')
        rows.replaceChildren(...breakdown(parsed.bytes).map((row) => copyRow(row.label, row.value)))
        error.hidden = true
      } catch (err) {
        formatted = ''
        summary.body.replaceChildren('')
        summary.setMeta('')
        summary.setLabel('Formatted')
        rows.replaceChildren()
        error.textContent = err instanceof Error ? err.message : 'Could not read that size.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Size', icon: 'ruler' },
          actions(
            field(input, { label: 'Value', grow: true }),
            field(decimals, { label: 'Decimals', grow: true }),
            checkbox({ label: 'Binary units (1024)', onChange: (checked) => { binary = checked; run() } }),
          ),
          error,
        ),
        summary,
        panel({ title: 'Every scale', icon: 'layers' }, rows),
        note('Decimal units use powers of 1000, binary units powers of 1024. Try "1 GB" and compare the two rows.'),
      ),
    )

    run()
  },
}

export default tool
