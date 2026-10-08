import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { binaryStats, binaryToText, groupBits, textToBinary } from './binary'

const tool: Tool = {
  slug: 'binary-text',
  name: 'Binary Text Converter',
  description: 'Turn text into its UTF-8 binary form and back, with optional grouping and bit reversal.',
  category: 'Data',
  keywords: ['binary', 'bits', 'text', 'utf-8', 'encode', 'decode', '0b', 'convert'],
  render(root) {
    const direction = el(
      'select',
      { class: 'ts-select' },
      el('option', { value: 'encode' }, 'Text → Binary'),
      el('option', { value: 'decode' }, 'Binary → Text'),
    ) as HTMLSelectElement
    const spaced = el('input', { type: 'checkbox', checked: true }) as HTMLInputElement
    const reversed = el('input', { type: 'checkbox' }) as HTMLInputElement
    const group = el('input', { type: 'checkbox', checked: true }) as HTMLInputElement
    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 8, spellcheck: false }) as HTMLTextAreaElement
    const output = el('textarea', { class: 'ts-textarea ts-mono', rows: 8, spellcheck: false, readonly: true }) as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const stats = el('p', { class: 'ts-muted' })
    let result = ''

    function run() {
      try {
        if (direction.value === 'encode') {
          result = textToBinary(input.value, { spaced: spaced.checked || group.checked, reversed: reversed.checked })
          if (group.checked) result = groupBits(result, 4)
          stats.textContent = `${textToBinary(input.value).length} bits · ${new TextEncoder().encode(input.value).length} bytes`
        } else {
          result = binaryToText(input.value, { reversed: reversed.checked })
          const info = binaryStats(input.value)
          stats.textContent = `${info.bits} bits · ${info.bytes} bytes · ${info.ones} ones (${Math.round(info.density * 100)}%)`
        }
        output.value = result
        error.hidden = true
      } catch (err) {
        result = ''
        output.value = ''
        stats.textContent = ''
        error.textContent = err instanceof Error ? err.message : 'Could not process that input.'
        error.hidden = false
      }
    }

    function sample() {
      input.value = direction.value === 'encode' ? 'Hi' : '01001000 01101001'
      run()
    }

    direction.addEventListener('change', sample)
    spaced.addEventListener('change', run)
    reversed.addEventListener('change', run)
    group.addEventListener('change', run)
    input.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Direction'), direction),
          el('label', { class: 'ts-inline-field' }, spaced, 'Space between bytes'),
          el('label', { class: 'ts-inline-field' }, group, 'Group in nibbles'),
          el('label', { class: 'ts-inline-field' }, reversed, 'Reverse bits'),
          el('button', { class: 'ts-button', type: 'button', onclick: sample }, 'Load sample'),
        ),
        el('div', { class: 'ts-field' }, el('label', {}, 'Input'), input),
        el('div', { class: 'ts-field' }, el('label', {}, 'Output'), output),
        error,
        el('div', { class: 'ts-row ts-between' }, stats, copyChip(() => result, 'Copy')),
        el('p', { class: 'ts-note' }, 'Text is encoded as UTF-8, so a non-ASCII character becomes the two or more bytes you would find in a file.'),
      ),
    )

    sample()
  },
}

export default tool
