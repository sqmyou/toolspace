import { el } from '../../core/dom'
import { copyChip, download, readFileAsArrayBuffer } from '../../core/ui'
import type { Tool } from '../../core/types'
import { decodeText, decodeTextUrl, encodeText, encodeTextUrl, toDataUri } from './base64'

const tool: Tool = {
  slug: 'base64',
  name: 'Base64 / Base64URL Codec',
  description: 'Encode and decode Base64 text or files, including the URL-safe variant.',
  category: 'Encoding',
  keywords: ['base64', 'base64url', 'encode', 'decode', 'data uri', 'atob', 'btoa'],
  render(root) {
    const input = el('textarea', {
      class: 'ts-textarea',
      rows: 6,
      placeholder: 'Text to encode, or paste Base64 to decode…',
      'aria-label': 'Input',
    }) as HTMLTextAreaElement
    const urlSafeBox = el('input', { type: 'checkbox' }) as HTMLInputElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const output = el('div', { class: 'ts-json-block' })
    const outHead = el('div', { class: 'ts-json-head' })
    const outText = el('textarea', { class: 'ts-textarea', rows: 8, readonly: true }) as HTMLTextAreaElement

    let lastAction: 'encode' | 'decode' = 'encode'

    function showOutput(label: string, value: string) {
      output.hidden = false
      error.hidden = true
      outHead.replaceChildren(el('span', {}, label), copyChip(() => outText.value, 'Copy'))
      outText.value = value
    }

    function encode() {
      lastAction = 'encode'
      showOutput('Encoded', urlSafeBox.checked ? encodeTextUrl(input.value) : encodeText(input.value))
    }

    function decode() {
      lastAction = 'decode'
      try {
        const value = urlSafeBox.checked ? decodeTextUrl(input.value) : decodeText(input.value)
        showOutput('Decoded', value)
      } catch (err) {
        output.hidden = false
        error.textContent = err instanceof Error ? err.message : 'Could not decode this value.'
        error.hidden = false
        outHead.replaceChildren(el('span', {}, 'Decoded'))
        outText.value = ''
      }
    }

    urlSafeBox.addEventListener('change', () => {
      if (lastAction === 'encode') encode()
    })

    const fileInput = el('input', { type: 'file' }) as HTMLInputElement
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]
      if (!file) return
      const buffer = await readFileAsArrayBuffer(file)
      showOutput(`File · ${file.name}`, toDataUri(new Uint8Array(buffer), file.type || 'application/octet-stream'))
    })

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Text'), input),
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('label', { class: 'ts-inline-field' }, urlSafeBox, 'URL-safe (no padding)'),
          el('button', { class: 'ts-button ts-primary', type: 'button', onclick: encode }, 'Encode'),
          el('button', { class: 'ts-button', type: 'button', onclick: decode }, 'Decode'),
        ),
        error,
        output,
        outHead,
        outText,
        el('h3', { class: 'ts-subhead' }, 'Encode a file'),
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          fileInput,
          el('button', {
            class: 'ts-button',
            type: 'button',
            onclick: () => download('data-uri.txt', outText.value),
          }, 'Download result'),
        ),
        el('p', { class: 'ts-note' }, 'Encoding and decoding happen in your browser; files never leave your machine.'),
      ),
    )
  },
}

export default tool
