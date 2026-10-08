import { el } from '../../core/dom'
import { copyChip, download } from '../../core/ui'
import type { Tool } from '../../core/types'
import {
  base32Decode, base32Encode, base58CheckDecode, base58CheckEncode, base58Decode, base58Encode,
  bytesFromText, fromBinary, fromHex, textFromBytes, toBinary, toHex,
} from './base'

type Format = 'base32' | 'base58' | 'base58check' | 'hex' | 'binary'

const tool: Tool = {
  slug: 'base-encodings',
  name: 'Base32 / Base58 / Hex / Binary Codec',
  description: 'Convert text to and from Base32, Base58, Base58Check, hex and binary.',
  category: 'Encoding',
  keywords: ['base32', 'base58', 'base58check', 'hex', 'binary', 'encode', 'decode'],
  render(root) {
    let format: Format = 'base32'
    const input = el('textarea', {
      class: 'ts-textarea',
      rows: 6,
      placeholder: 'Text to encode, or encoded value to decode…',
      'aria-label': 'Input',
    }) as HTMLTextAreaElement

    const formatSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    formatSelect.append(
      el('option', { value: 'base32' }, 'Base32'),
      el('option', { value: 'base58' }, 'Base58'),
      el('option', { value: 'base58check' }, 'Base58Check'),
      el('option', { value: 'hex' }, 'Hex'),
      el('option', { value: 'binary' }, 'Binary'),
    )
    formatSelect.addEventListener('change', () => {
      format = formatSelect.value as Format
    })

    const output = el('div', { class: 'ts-json-block' })
    const outHead = el('div', { class: 'ts-json-head' })
    const outText = el('textarea', { class: 'ts-textarea', rows: 6, readonly: true }) as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })

    function showOutput(label: string, value: string) {
      output.hidden = false
      error.hidden = true
      outHead.replaceChildren(el('span', {}, label), copyChip(() => outText.value, 'Copy'))
      outText.value = value
    }

    function fail(err: unknown) {
      output.hidden = false
      outHead.replaceChildren(el('span', {}, 'Error'))
      outText.value = ''
      error.textContent = err instanceof Error ? err.message : 'Could not convert this value.'
      error.hidden = false
    }

    async function run(action: 'encode' | 'decode') {
      try {
        const bytes = bytesFromText(input.value)
        if (action === 'encode') {
          const value =
            format === 'base32' ? base32Encode(bytes)
            : format === 'base58' ? base58Encode(bytes)
            : format === 'base58check' ? await base58CheckEncode(bytes)
            : format === 'hex' ? toHex(bytes, true)
            : toBinary(bytes)
          showOutput('Encoded', value)
          return
        }
        const decoded =
          format === 'base32' ? base32Decode(input.value)
          : format === 'base58' ? base58Decode(input.value.trim())
          : format === 'base58check' ? await base58CheckDecode(input.value.trim())
          : format === 'hex' ? fromHex(input.value)
          : fromBinary(input.value)
        showOutput('Decoded', textFromBytes(decoded))
      } catch (err) {
        fail(err)
      }
    }

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el('div', { class: 'ts-inline-field' }, el('label', {}, 'Format'), formatSelect),
        el('div', { class: 'ts-field' }, el('label', {}, 'Input'), input),
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('button', { class: 'ts-button ts-primary', type: 'button', onclick: () => run('encode') }, 'Encode'),
          el('button', { class: 'ts-button', type: 'button', onclick: () => run('decode') }, 'Decode'),
        ),
        error,
        output,
        outHead,
        outText,
        el('div', { class: 'ts-row ts-wrap' }, copyChip(() => outText.value, 'Copy result'),
          el('button', {
            class: 'ts-button',
            type: 'button',
            onclick: () => download('encoded.txt', outText.value),
          }, 'Download')),
        el('p', { class: 'ts-note' }, 'Conversions run locally. Base58Check uses your browser’s SHA-256.'),
      ),
    )
  },
}

export default tool
