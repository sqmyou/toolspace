import {
  actions,
  copyButton,
  field,
  note,
  outputBlock,
  panel,
  segmented,
  stat,
  stats,
  textarea,
  toolLayout,
} from '../../core/components'
import { fromBase64, parseHex } from '../hex-viewer/hex'
import type { Tool } from '../../core/types'
import { DecodeError, decodeCbor, decodeMsgpack, formatTree, toJson, uniqueNotes } from './decode'

/** Accept hex or base64, the two ways people paste a binary payload. */
function parsePayload(text: string): Uint8Array {
  const compact = text.replace(/\s+/g, '')
  if (!compact) throw new DecodeError('The input is empty.')
  if (/^[0-9a-f]+$/i.test(compact) && compact.length % 2 === 0) return parseHex(compact)
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return fromBase64(compact)
  throw new DecodeError('Input must be hex or base64.')
}

const MSGPACK_SAMPLE = '82a16101a16292c3c4020102'

const tool: Tool = {
  slug: 'msgpack-cbor',
  name: 'MessagePack & CBOR',
  description: 'Decode MessagePack or CBOR payloads into a readable tree without a schema.',
  category: 'Data',
  keywords: ['msgpack', 'messagepack', 'cbor', 'decode', 'binary', 'serialization', 'hex', 'base64'],
  render(root) {
    let format: 'msgpack' | 'cbor' = 'msgpack'
    const input = textarea({ rows: 6, placeholder: 'Hex or base64 payload…', onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    let treeText = ''
    const tree = outputBlock('', { label: 'Decoded tree', copy: () => treeText })
    let jsonText = ''
    const json = outputBlock('', { label: 'JSON view', copy: () => jsonText })
    const counters = stats()
    const renderCounters = (used: number, trailing: number) => {
      counters.replaceChildren(
        stat({ label: 'Format', value: format === 'msgpack' ? 'MessagePack' : 'CBOR' }),
        stat({ label: 'Bytes', value: String(used) }),
        stat({ label: 'Trailing', value: String(trailing) }),
      )
    }
    const notes = note('')
    notes.hidden = true

    const formatControl = segmented({
      label: 'Format',
      value: format,
      items: [
        { value: 'msgpack', label: 'MessagePack' },
        { value: 'cbor', label: 'CBOR' },
      ],
      onChange: (value) => {
        format = value as 'msgpack' | 'cbor'
        run()
      },
    })

    function run() {
      tree.body.replaceChildren()
      json.body.replaceChildren()
      treeText = ''
      jsonText = ''
      try {
        const bytes = parsePayload(input.value)
        const { value, rest } = format === 'msgpack' ? decodeMsgpack(bytes) : decodeCbor(bytes)
        treeText = formatTree(value)
        tree.body.replaceChildren(treeText)
        const collected: string[] = []
        jsonText = JSON.stringify(toJson(value, collected), null, 2)
        json.body.replaceChildren(jsonText)
        tree.setMeta(`${bytes.length} bytes`)
        json.setMeta('')
        renderCounters(bytes.length, rest)
        const shown = uniqueNotes(collected)
        notes.textContent = shown.join(' ')
        notes.hidden = shown.length === 0
        error.hidden = true
      } catch (err) {
        renderCounters(0, 0)
        error.textContent = err instanceof DecodeError ? err.message : 'Could not decode that payload.'
        error.hidden = false
        notes.hidden = true
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Payload', icon: 'code' },
          formatControl,
          field(input, { label: 'Payload (hex or base64)' }),
          error,
        ),
        panel(
          { title: 'Decoded', icon: 'layers' },
          counters,
          actions(copyButton(() => treeText, { label: 'Copy tree', size: 'sm' })),
          tree,
          notes,
        ),
        panel(
          { title: 'JSON', icon: 'braces' },
          actions(copyButton(() => jsonText, { label: 'Copy JSON', size: 'sm' })),
          json,
        ),
        note('Byte strings, tags and integers beyond the safe range cannot be shown as plain JSON, so the JSON view wraps or quotes them. The tree view is the lossless one.'),
      ),
    )

    input.value = MSGPACK_SAMPLE
    run()
  },
}

export default tool
