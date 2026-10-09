import {
  actions,
  button,
  checkbox,
  field,
  note,
  outputBlock,
  panel,
  segmented,
  stat,
  stats,
  textarea,
  textField,
  toolLayout,
} from '../../core/components'
import { download, readFileAsArrayBuffer } from '../../core/ui'
import type { Tool } from '../../core/types'
import { bytesFromText, fromBase64, hexDump, parseHex, textFromBytes, toBase64, toHex } from './hex'

const tool: Tool = {
  slug: 'hex-viewer',
  name: 'Hex & Base64 Viewer',
  description: 'Inspect text, hex or base64 as bytes, with a hex dump and the other encodings side by side.',
  category: 'Data',
  keywords: ['hex', 'hexdump', 'base64', 'bytes', 'binary', 'dump', 'encoding', 'decode'],
  render(root) {
    let mode = 'text'
    let uppercase = false

    const modeControl = segmented({
      label: 'Input as',
      items: [
        { value: 'text', label: 'Text', hint: 'UTF-8' },
        { value: 'hex', label: 'Hex' },
        { value: 'base64', label: 'Base64' },
      ],
      value: mode,
      onChange: (value) => {
        mode = value
        render()
      },
    })

    const bytesPerLine = textField({ value: '16', type: 'number', mono: true, onInput: () => render() })
    bytesPerLine.min = '1'
    bytesPerLine.max = '64'

    const uppercaseBox = checkbox({ label: 'Upper case hex', onChange: (checked) => { uppercase = checked; render() } })

    const input = textarea({ rows: 8, placeholder: 'Type or paste, or load a file below', onInput: () => render() })

    const error = note('', 'danger')
    error.hidden = true

    const file = document.createElement('input')
    file.type = 'file'
    file.className = 'ts-k-input'
    file.addEventListener('change', () => void loadFile(file.files?.[0]))

    const dump = document.createElement('pre')
    dump.className = 'ts-pre ts-hex-dump'
    const dumpOut = outputBlock(dump, { label: 'Hex dump', meta: '16 bytes per line' })
    dumpOut.body.replaceChildren(dump)
    

    const figure = stats()
    const conversions = document.createElement('div')
    conversions.className = 'ts-hex-fields'

    let bytes: Uint8Array<ArrayBufferLike> = new Uint8Array(0)

    function render() {
      conversions.replaceChildren()
      try {
        if (mode === 'text') bytes = bytesFromText(input.value)
        else if (mode === 'hex') bytes = parseHex(input.value)
        else bytes = fromBase64(input.value)
        error.hidden = true
      } catch (err) {
        bytes = new Uint8Array(0)
        error.textContent = err instanceof Error ? err.message : 'Could not read that input.'
        error.hidden = false
      }

      const hexText = toHex(bytes, { uppercase, group: 1 })
      const hexCompact = toHex(bytes, { uppercase, group: 0 })
      const base64Text = toBase64(bytes)
      const text = textFromBytes(bytes)
      const perLine = Number(bytesPerLine.value) || 16

      dump.textContent = bytes.length ? hexDump(bytes, { bytesPerLine: perLine }) : '(no bytes)'
      dumpOut.setMeta( `${perLine} bytes per line`)
      figure.replaceChildren(
        stat({ label: 'Bytes', value: String(bytes.length) }),
        stat({ label: 'Bits', value: String(bytes.length * 8) }),
        stat({ label: 'Base64', value: base64Text ? `${base64Text.length} chars` : '—' }),
      )

      for (const [label, value] of [
        ['Hex', hexText],
        ['Hex (compact)', hexCompact],
        ['Base64', base64Text],
        ['Text', text],
      ] as const) {
        const pre = document.createElement('pre')
        pre.className = 'ts-pre ts-hex-value'
        pre.textContent = value || '(empty)'
        const block = outputBlock(pre, { label, copy: () => value })
        block.body.replaceChildren(pre)
        conversions.append(block)
      }
    }

    async function loadFile(selected: File | undefined) {
      if (!selected) return
      bytes = new Uint8Array(await readFileAsArrayBuffer(selected))
      mode = 'hex'
      input.value = toHex(bytes, { uppercase, group: 1 })
      render()
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Options', icon: 'sliders' },
          modeControl,
          actions(field(bytesPerLine, { label: 'Bytes per line' }), uppercaseBox),
        ),
        panel(
          { title: 'Input', icon: 'braces' },
          input,
          field(file, { label: 'Or load a file' }),
        ),
        error,
        figure,
        dumpOut,
        actions(
          button('Download dump', { icon: 'download', onClick: () => download('dump.txt', dump.textContent ?? '') }),
        ),
        conversions,
        note('Text is encoded as UTF-8. Invalid bytes are shown as a replacement character rather than failing.'),
      ),
    )

    input.value = 'Hello, toolspace!'
    render()
  },
}

export default tool
