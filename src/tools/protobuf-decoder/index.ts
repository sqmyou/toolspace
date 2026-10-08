import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { decodeProtobuf, formatFields, parsePayload, ProtobufError, type ProtoField } from './proto'

function fieldRow(field: ProtoField): HTMLElement {
  const row = el('div', { class: 'ts-proto-row' })
  row.append(
    el('span', { class: 'ts-proto-num' }, `${field.number}`),
    el('span', { class: 'ts-proto-wire' }, field.wireName),
    el('span', { class: 'ts-proto-value' }, field.value),
  )
  if (field.children) {
    const nested = el('div', { class: 'ts-proto-nested' })
    for (const child of field.children) nested.append(fieldRow(child))
    row.append(nested)
  }
  return row
}

const tool: Tool = {
  slug: 'protobuf-decoder',
  name: 'Protobuf Decoder',
  description: 'Decode an unknown protobuf payload into readable fields without a .proto file.',
  category: 'Data',
  keywords: ['protobuf', 'proto', 'decode', 'grpc', 'wire', 'binary', 'varint'],
  render(root) {
    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 8, spellcheck: false, placeholder: 'Hex or base64 payload…' }) as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const summary = el('p', { class: 'ts-muted' })
    const output = el('div', { class: 'ts-proto-tree' })
    let plain = ''

    function run() {
      output.replaceChildren()
      plain = ''
      if (!input.value.trim()) {
        error.hidden = true
        summary.textContent = ''
        return
      }
      try {
        const fields = decodeProtobuf(parsePayload(input.value))
        error.hidden = true
        summary.textContent = `${fields.length} top-level field${fields.length === 1 ? '' : 's'}`
        plain = formatFields(fields)
        for (const field of fields) output.append(fieldRow(field))
      } catch (err) {
        error.textContent = err instanceof ProtobufError ? err.message : 'Could not decode that payload.'
        error.hidden = false
        summary.textContent = ''
      }
    }

    input.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Payload (hex or base64)'), input),
        error,
        el(
          'div',
          { class: 'ts-row ts-between' },
          summary,
          copyChip(() => plain, 'Copy as text'),
        ),
        output,
        el('p', { class: 'ts-note' }, 'Field names cannot be recovered without a schema, so values are shown by number and best-guess type.'),
      ),
    )

    run()
  },
}

export default tool
