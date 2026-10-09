import {
  actions,
  button,
  checkbox,
  copyButton,
  field,
  kvList,
  note,
  outputBlock,
  panel,
  select,
  stat,
  stats,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { describe, digitRange, formatInBase, groupDigits, parseInBase } from './number'

const BASE_LABEL: Record<number, string> = { 2: 'binary', 8: 'octal', 10: 'decimal', 16: 'hex' }
/** Where breaks make a digit string easiest to read. */
const AUTO_GROUP: Record<number, number> = { 2: 4, 8: 3, 10: 3, 16: 4 }

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
    let grouping = -1
    let uppercase = false
    // The clean output for the clipboard, independent of the grouped display.
    let rawResult = ''

    const input = textField({ mono: true, value: '255', onInput: () => run() })
    input.id = 'ts-nb-value'
    input.setAttribute('autocomplete', 'off')
    input.setAttribute('spellcheck', 'false')
    input.setAttribute('inputmode', 'text')

    const inputHint = el('p', { class: 'ts-k-hint' })
    inputHint.id = 'ts-nb-value-hint'
    // Tie the accepted-digit hint to the field so it is read out with the label.
    input.setAttribute('aria-describedby', inputHint.id)
    function updateHint() {
      inputHint.textContent = `Accepts ${digitRange(inputBase)}. Spaces, commas, underscores and apostrophes are ignored.`
      input.placeholder = inputBase === 2 ? '1010' : inputBase === 8 ? '377' : inputBase === 16 ? 'ff' : inputBase === 10 ? '255' : 'value'
    }
    updateHint()

    const error = note('', 'danger')
    error.hidden = true
    // Announced when it appears, without stealing focus from the value field.
    error.setAttribute('aria-live', 'polite')

    const result = outputBlock('', {
      label: 'Result',
      // Copy the clean digits, not the grouped display.
      copy: () => rawResult,
    })
    const rows = kvList()
    rows.classList.add('ts-nb-bases')
    // The result block below is the single live region; this redundant "all
    // bases" list stays silent so a keystroke is not announced twice with long
    // digit strings.
    const statsRow = stats()

    const from = select({
      options: baseOptions(),
      value: String(inputBase),
      onChange: (value) => {
        inputBase = Number(value)
        updateHint()
        run()
      },
    })
    from.id = 'ts-nb-from'
    const to = select({
      options: baseOptions(),
      value: String(outputBase),
      onChange: (value) => {
        outputBase = Number(value)
        run()
      },
    })
    to.id = 'ts-nb-to'
    const padding = select({
      options: [0, 4, 8, 16, 32, 64, 128].map((bits) => ({
        value: String(bits),
        label: bits ? `Pad to ${bits} bits` : 'No padding',
      })),
      value: '0',
      onChange: (value) => {
        padBits = Number(value)
        run()
      },
    })
    padding.id = 'ts-nb-pad'
    const groupBy = select({
      options: [{ value: '-1', label: 'Auto grouping' }, ...[0, 3, 4, 8].map((size) => ({ value: String(size), label: size ? `Group by ${size}` : 'No grouping' }))],
      value: '-1',
      onChange: (value) => {
        grouping = Number(value)
        run()
      },
    })
    groupBy.id = 'ts-nb-group'

    for (const control of [from, to, padding, groupBy]) control.classList.add('ts-nb-select')

    function groupSize(base: number): number {
      return grouping === -1 ? AUTO_GROUP[base] ?? 0 : grouping
    }

    function display(text: string, base: number): string {
      const size = groupSize(base)
      return size > 0 ? groupDigits(text, size) : text
    }

    // A "All bases" row: grouped on screen for readability, but the copy button
    // hands over the clean digits so they can be pasted straight into code.
    function baseRow(label: string, raw: string, base: number): HTMLElement {
      const row = el(
        'div',
        { class: 'ts-k-kv' },
        el('span', { class: 'ts-k-kv__label' }, label),
        el('span', { class: 'ts-k-kv__value ts-k-mono' }, display(raw, base)),
      )
      const copy = copyButton(raw, { label: 'Copy', size: 'sm' })
      copy.setAttribute('aria-label', `Copy ${label} value`)
      row.append(copy)
      return row
    }

    function swap() {
      // Carry the current result across as the new input so the two panes stay
      // in step: parse it in the *old* output base before the bases swap.
      const carried = rawResult ? parseInBase(rawResult, outputBase) : null

      const nextInput = outputBase
      const nextOutput = inputBase
      from.value = String(nextInput)
      to.value = String(nextOutput)
      inputBase = nextInput
      outputBase = nextOutput

      if (carried !== null) input.value = formatInBase(carried, inputBase, 0, uppercase)
      updateHint()
      run()
    }

    function clearAll() {
      input.value = ''
      run()
      input.focus()
    }

    function run() {
      const raw = input.value.trim()
      if (!raw) {
        error.hidden = true
        rawResult = ''
        result.setValue('—')
        result.setLabel('Result')
        result.setMeta('')
        statsRow.replaceChildren()
        rows.replaceChildren(note('Type a value to see it in every base.', 'neutral'))
        return
      }
      try {
        const value = parseInBase(input.value, inputBase)
        const converted = describe(value, padBits, uppercase)

        error.hidden = true

        const outText = formatInBase(value, outputBase, padBits, uppercase)
        rawResult = outText
        result.setValue(display(outText, outputBase))
        result.setLabel(`Result in base ${outputBase}`)
        result.setMeta(BASE_LABEL[outputBase] ?? '')

        statsRow.replaceChildren(
          stat({ label: 'Bits', value: String(converted.bitLength) }),
          stat({ label: 'Bytes', value: String(converted.byteLength) }),
          stat({ label: `Base ${outputBase} digits`, value: String(outText.replace('-', '').length) }),
        )

        const entries: [string, string, number][] = [
          ['Decimal', converted.decimal, 10],
          ['Hexadecimal', converted.hex, 16],
          ['Octal', converted.octal, 8],
          ['Binary', converted.binary, 2],
        ]
        if (![2, 8, 10, 16].includes(outputBase)) entries.push([`Base ${outputBase}`, outText, outputBase])

        rows.replaceChildren(...entries.map(([label, text, base]) => baseRow(label, text, base)))
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not convert this value.'
        error.hidden = false
        rawResult = ''
        result.setValue('—')
        result.setLabel('Result')
        result.setMeta('')
        statsRow.replaceChildren()
        rows.replaceChildren()
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Value', icon: 'hash' },
          field(input, { label: 'Value', forId: input.id }),
          inputHint,
          actions(
            field(from, { label: 'From', forId: from.id, grow: true }),
            button('Swap', { icon: 'swap', variant: 'ghost', onClick: swap, title: 'Swap the from and to bases' }),
            field(to, { label: 'To', forId: to.id, grow: true }),
          ),
          actions(
            field(padding, { label: 'Padding', forId: padding.id, grow: true }),
            field(groupBy, { label: 'Grouping', forId: groupBy.id, grow: true }),
          ),
          actions(
            checkbox({
              label: 'Uppercase letters',
              hint: 'hex and higher bases',
              onChange: (checked) => {
                uppercase = checked
                run()
              },
            }),
            button('Clear', { icon: 'eraser', variant: 'ghost', onClick: clearAll }),
          ),
          error,
          // Results change without a navigation; tell assistive tech so it is
          // announced rather than silently updated.
          el('div', { 'aria-live': 'polite', class: 'ts-nb-live' },
            result,
            statsRow,
          ),
        ),
        panel({ title: 'All bases', icon: 'layers' }, rows),
        note('Conversion uses arbitrary-precision integers, so large values stay exact.'),
      ),
    )

    input.focus()
    run()
  },
}

export default tool
