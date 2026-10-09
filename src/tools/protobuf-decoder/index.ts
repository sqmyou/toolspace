import {
  actions,
  copyButton,
  field,
  note,
  panel,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { decodeProtobuf, formatFields, parsePayload, ProtobufError, type ProtoField } from './proto'

function fieldRow(field: ProtoField): HTMLElement {
  const row = el(
    'div',
    { class: 'ts-proto-row' },
    el('span', { class: 'ts-proto-num' }, `${field.number}`),
    el('span', { class: 'ts-proto-wire' }, field.wireName),
    el('span', { class: 'ts-proto-value' }, field.value),
  )
  if (field.children) {
    row.append(el('div', { class: 'ts-proto-nested' }, ...field.children.map(fieldRow)))
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
    const input = textarea({ rows: 8, placeholder: 'Hex or base64 payload…', onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    const summary = note('')
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
        output.append(...fields.map(fieldRow))
      } catch (err) {
        error.textContent = err instanceof ProtobufError ? err.message : 'Could not decode that payload.'
        error.hidden = false
        summary.textContent = ''
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Payload', icon: 'code' },
          field(input, { label: 'Payload (hex or base64)' }),
          error,
        ),
        panel(
          { title: 'Fields', icon: 'layers' },
          actions(summary, copyButton(() => plain, { label: 'Copy as text', size: 'sm' })),
          output,
        ),
        note('Field names cannot be recovered without a schema, so values are shown by number and best-guess type.'),
      ),
    )

    run()
  },
}

export default tool
