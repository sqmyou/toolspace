import {
  actions,
  checkbox,
  copyRow,
  field,
  kvList,
  note,
  outputBlock,
  panel,
  select,
  textField,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { convert, formatInBase, groupDigits, parseInBase } from './number'

const BASE_LABEL: Record<number, string> = { 2: 'binary', 8: 'octal', 10: 'decimal', 16: 'hex' }

function baseOptions() {
  return Array.from({ length: 35 }, (_, index) => index + 2).map((base) => ({
    value: String(base),
    label: `Base ${base}${BASE_LABEL[base] ? ` (${BASE_LABEL[base]})` : ''}`,
  }))
}

const tool: Tool = {
  slug: 'number-base',
  name: 'Number Base Converter',
  description: 'Convert integers between any bases from 2 to 36 with arbitrary precision.',
  category: 'Numbers',
  keywords: ['binary', 'hex', 'octal', 'decimal', 'radix', 'base conversion', 'bigint'],
  render(root) {
    let inputBase = 10
    let outputBase = 16
    let padBits = 0
    let grouping = 0
    let uppercase = false

    const input = textField({ value: '255', mono: true, onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    const result = outputBlock('', { label: 'Result', copy: () => result.body.textContent ?? '' })
    const rows = kvList()

    const from = select({
      options: baseOptions(),
      value: String(inputBase),
      onChange: (value) => {
        inputBase = Number(value)
        run()
      },
    })
    const to = select({
      options: baseOptions(),
      value: String(outputBase),
      onChange: (value) => {
        outputBase = Number(value)
        run()
      },
    })
    const padding = select({
      options: [0, 8, 16, 32, 64, 128].map((bits) => ({
        value: String(bits),
        label: bits ? `Pad to ${bits} bits` : 'No padding',
      })),
      value: '0',
      onChange: (value) => {
        padBits = Number(value)
        run()
      },
    })
    const groupBy = select({
      options: [0, 4, 8].map((size) => ({ value: String(size), label: size ? `Group by ${size}` : 'No grouping' })),
      value: '0',
      onChange: (value) => {
        grouping = Number(value)
        run()
      },
    })

    function run() {
      try {
        const value = parseInBase(input.value, inputBase)
        const converted = convert(input.value, inputBase, padBits, uppercase)
        error.hidden = true
        result.body.replaceChildren(formatInBase(value, outputBase, padBits))
        result.setMeta(`base ${outputBase}`)
        result.setLabel('Result')
        const entries: [string, string][] = [
          ['Decimal', converted.decimal],
          ['Hexadecimal', converted.hex],
          ['Octal', converted.octal],
          ['Binary', converted.binary],
        ]
        rows.replaceChildren(
          ...entries.map(([label, text]) => {
            const display = grouping > 0 && (label === 'Binary' || label === 'Hexadecimal')
              ? groupDigits(text, grouping)
              : text
            return copyRow(label, display)
          }),
        )
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not convert this value.'
        error.hidden = false
        result.body.replaceChildren('')
        result.setMeta('')
        rows.replaceChildren()
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Value', icon: 'hash' },
          field(input, { label: 'Value' }),
          actions(
            field(from, { label: 'From', grow: true }),
            field(to, { label: 'To', grow: true }),
            field(padding, { label: 'Padding', grow: true }),
            field(groupBy, { label: 'Grouping', grow: true }),
          ),
          checkbox({ label: 'Uppercase hex', onChange: (checked) => { uppercase = checked; run() } }),
          error,
        ),
        result,
        panel({ title: 'All bases', icon: 'layers' }, rows),
        note('Conversion uses arbitrary-precision integers, so large values stay exact.'),
      ),
    )

    run()
  },
}

export default tool
