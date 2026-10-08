import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { convert, formatInBase, groupDigits, parseInBase } from './number'

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

    const input = el('input', { class: 'ts-input ts-mono', value: '255', 'aria-label': 'Value' }) as HTMLInputElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const outValue = el('code', { class: 'ts-mono ts-big-value' })
    const table = el('div', { class: 'ts-copy-list' })

    function baseSelect(current: number, onChange: (value: number) => void): HTMLSelectElement {
      const select = el('select', { class: 'ts-select' }) as HTMLSelectElement
      for (let base = 2; base <= 36; base++) {
        select.append(el('option', { value: String(base) }, `Base ${base}${base === 10 ? ' (decimal)' : base === 16 ? ' (hex)' : base === 8 ? ' (octal)' : base === 2 ? ' (binary)' : ''}`))
      }
      select.value = String(current)
      select.addEventListener('change', () => onChange(Number(select.value)))
      return select
    }

    const padSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const bits of [0, 8, 16, 32, 64, 128]) padSelect.append(el('option', { value: String(bits) }, bits ? `Pad to ${bits} bits` : 'No padding'))
    padSelect.addEventListener('change', () => {
      padBits = Number(padSelect.value)
      run()
    })

    const groupSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const size of [0, 4, 8]) groupSelect.append(el('option', { value: String(size) }, size ? `Group by ${size}` : 'No grouping'))
    groupSelect.addEventListener('change', () => {
      grouping = Number(groupSelect.value)
      run()
    })

    const upperBox = el('input', { type: 'checkbox' }) as HTMLInputElement
    upperBox.addEventListener('change', () => {
      uppercase = upperBox.checked
      run()
    })

    function run() {
      try {
        const value = parseInBase(input.value, inputBase)
        const result = convert(input.value, inputBase, padBits, uppercase)
        error.hidden = true
        outValue.textContent = formatInBase(value, outputBase, padBits)
        const rows: [string, string][] = [
          ['Decimal', result.decimal],
          ['Hexadecimal', result.hex],
          ['Octal', result.octal],
          ['Binary', result.binary],
        ]
        table.replaceChildren(
          ...rows.map(([label, text]) => {
            const display = grouping > 0 && (label === 'Binary' || label === 'Hexadecimal') ? groupDigits(text, grouping) : text
            return el(
              'div',
              { class: 'ts-copy-row' },
              el('span', { class: 'ts-muted' }, label),
              el('code', { class: 'ts-mono ts-value' }, display),
              copyChip(() => text),
            )
          }),
        )
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not convert this value.'
        error.hidden = false
        outValue.textContent = ''
        table.replaceChildren()
      }
    }

    input.addEventListener('input', run)

    const inputBaseSelect = baseSelect(inputBase, (value) => {
      inputBase = value
      run()
    })
    const outputBaseSelect = baseSelect(outputBase, (value) => {
      outputBase = value
      run()
    })

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Value'), input),
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'From'), inputBaseSelect),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'To'), outputBaseSelect),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Padding'), padSelect),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Grouping'), groupSelect),
          el('label', { class: 'ts-inline-field' }, upperBox, 'Uppercase hex'),
        ),
        error,
        el('div', { class: 'ts-field' }, el('label', {}, 'Result'), outValue),
        el('h3', { class: 'ts-subhead' }, 'All bases'),
        table,
        el('p', { class: 'ts-note' }, 'Conversion uses arbitrary-precision integers, so large values stay exact.'),
      ),
    )

    run()
  },
}

export default tool
