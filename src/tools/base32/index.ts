import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { decodeText, encodeText } from './base32'

const tool: Tool = {
  slug: 'base32',
  name: 'Base32 Encoder & Decoder',
  description: 'Encode and decode base32 in RFC 4648 and Crockford variants, with TOTP-friendly secrets.',
  category: 'Data',
  keywords: ['base32', 'rfc4648', 'crockford', 'encode', 'decode', 'totp', 'secret', '2fa'],
  render(root) {
    const direction = el(
      'select',
      { class: 'ts-select' },
      el('option', { value: 'encode' }, 'Text → Base32'),
      el('option', { value: 'decode' }, 'Base32 → Text'),
    ) as HTMLSelectElement
    const variant = el(
      'select',
      { class: 'ts-select' },
      el('option', { value: 'rfc4648' }, 'RFC 4648 (A-Z, 2-7)'),
      el('option', { value: 'crockford' }, "Crockford (no I, L, O, U)"),
    ) as HTMLSelectElement
    const padding = el('input', { type: 'checkbox', checked: true }) as HTMLInputElement
    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 8, spellcheck: false }) as HTMLTextAreaElement
    const output = el('textarea', { class: 'ts-textarea ts-mono', rows: 8, spellcheck: false, readonly: true }) as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })
    let result = ''

    function run() {
      try {
        const options = { variant: variant.value as 'rfc4648' | 'crockford', padding: padding.checked }
        result = direction.value === 'encode' ? encodeText(input.value, options) : decodeText(input.value, options)
        output.value = result
        error.hidden = true
      } catch (err) {
        result = ''
        output.value = ''
        error.textContent = err instanceof Error ? err.message : 'Could not process that input.'
        error.hidden = false
      }
    }

    function sample() {
      input.value = direction.value === 'encode' ? 'toolspace' : 'ORSXG5A='
      run()
    }

    direction.addEventListener('change', sample)
    variant.addEventListener('change', run)
    padding.addEventListener('change', run)
    input.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Direction'), direction),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Variant'), variant),
          el('label', { class: 'ts-inline-field' }, padding, 'Pad with "="'),
          el('button', { class: 'ts-button', type: 'button', onclick: sample }, 'Load sample'),
        ),
        el('div', { class: 'ts-field' }, el('label', {}, 'Input'), input),
        el('div', { class: 'ts-field' }, el('label', {}, 'Output'), output),
        error,
        el('div', { class: 'ts-row ts-between' }, el('span', { class: 'ts-muted' }, `${result.length} characters`), copyChip(() => result, 'Copy')),
        el('p', { class: 'ts-note' }, 'RFC 4648 uses A-Z and 2-7 with "=" padding. Crockford drops padding and the letters I, L, O and U, and decoding folds 1/I/L and 0/O together.'),
      ),
    )

    sample()
  },
}

export default tool
