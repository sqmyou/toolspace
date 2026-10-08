import { el } from '../../core/dom'
import { copyChip, download, readFileAsArrayBuffer } from '../../core/ui'
import type { Tool } from '../../core/types'
import { bytesFromText, fromBase64, hexDump, parseHex, textFromBytes, toBase64, toHex } from './hex'

const tool: Tool = {
  slug: 'hex-viewer',
  name: 'Hex & Base64 Viewer',
  description: 'Inspect text, hex or base64 as bytes, with a hex dump and the other encodings side by side.',
  category: 'Data',
  keywords: ['hex', 'hexdump', 'base64', 'bytes', 'binary', 'dump', 'encoding', 'decode'],
  render(root) {
    const mode = el(
      'select',
      { class: 'ts-select' },
      el('option', { value: 'text' }, 'Text (UTF-8)'),
      el('option', { value: 'hex' }, 'Hex'),
      el('option', { value: 'base64' }, 'Base64'),
    ) as HTMLSelectElement
    const bytesPerLine = el('input', { class: 'ts-input ts-mono', type: 'number', min: '1', max: '64', value: '16' }) as HTMLInputElement
    const uppercase = el('input', { type: 'checkbox' }) as HTMLInputElement
    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 8, spellcheck: false, placeholder: 'Type or paste, or drop a file below' }) as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const file = el('input', { class: 'ts-input', type: 'file' }) as HTMLInputElement
    const dump = el('pre', { class: 'ts-pre ts-hex-dump' })
    const summary = el('p', { class: 'ts-muted' })
    const conversions = el('div', { class: 'ts-hex-fields' })
    let bytes: Uint8Array<ArrayBufferLike> = new Uint8Array(0)

    function render() {
      conversions.replaceChildren()
      try {
        if (mode.value === 'text') bytes = bytesFromText(input.value)
        else if (mode.value === 'hex') bytes = parseHex(input.value)
        else bytes = fromBase64(input.value)
        error.hidden = true
      } catch (err) {
        bytes = new Uint8Array(0)
        error.textContent = err instanceof Error ? err.message : 'Could not read that input.'
        error.hidden = false
      }

      const hexText = toHex(bytes, { uppercase: uppercase.checked, group: 1 })
      const hexCompact = toHex(bytes, { uppercase: uppercase.checked, group: 0 })
      const base64Text = toBase64(bytes)
      const text = textFromBytes(bytes)

      dump.textContent = bytes.length ? hexDump(bytes, { bytesPerLine: Number(bytesPerLine.value) || 16 }) : '(no bytes)'
      summary.textContent = `${bytes.length} ${bytes.length === 1 ? 'byte' : 'bytes'}`

      for (const [label, value] of [
        ['Hex', hexText],
        ['Hex (compact)', hexCompact],
        ['Base64', base64Text],
        ['Text', text],
      ] as const) {
        conversions.append(el('div', { class: 'ts-field' }, el('div', { class: 'ts-row ts-between' }, el('label', {}, label), copyChip(() => value, 'Copy')), el('pre', { class: 'ts-pre ts-hex-value' }, value || '(empty)')))
      }
    }

    async function loadFile(selected: File | undefined) {
      if (!selected) return
      bytes = new Uint8Array(await readFileAsArrayBuffer(selected))
      mode.value = 'hex'
      input.value = toHex(bytes, { uppercase: uppercase.checked, group: 1 })
      render()
    }

    mode.addEventListener('change', render)
    bytesPerLine.addEventListener('input', render)
    uppercase.addEventListener('change', render)
    input.addEventListener('input', render)
    file.addEventListener('change', () => void loadFile(file.files?.[0]))

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Input as'), mode),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Bytes per line'), bytesPerLine),
          el('label', { class: 'ts-inline-field' }, uppercase, 'Upper case hex'),
        ),
        el('div', { class: 'ts-field' }, el('label', {}, 'Input'), input),
        el('div', { class: 'ts-field' }, el('label', {}, 'Or load a file'), file),
        error,
        el('div', { class: 'ts-row ts-between' }, summary, el('button', { class: 'ts-button', type: 'button', onclick: () => download('dump.txt', dump.textContent ?? '') }, 'Download dump')),
        dump,
        conversions,
        el('p', { class: 'ts-note' }, 'Text is encoded as UTF-8. Invalid bytes are shown as a replacement character rather than failing. Files are read in the browser only.'),
      ),
    )

    input.value = 'Hello, toolspace!'
    render()
  },
}

export default tool
