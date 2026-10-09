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
import type { Tool } from '../../core/types'
import { decode, formatTree, toJson, uniqueNotes } from './bencode'
import { parseHex, fromBase64 } from '../hex-viewer/hex'
import { BencodeError } from './bencode'

/** Accept text, hex or base64, the ways people paste a bencode payload. */
function parsePayload(text: string, format: 'text' | 'hex' | 'base64'): Uint8Array {
  if (format === 'hex') {
    const compact = text.replace(/\s+/g, '')
    if (!compact) throw new BencodeError('The input is empty.')
    if (!/^[0-9a-f]+$/i.test(compact)) throw new BencodeError('Hex input must contain only 0-9 and a-f.')
    return parseHex(compact)
  }
  if (format === 'base64') {
    const compact = text.replace(/\s+/g, '')
    if (!compact) throw new BencodeError('The input is empty.')
    return fromBase64(compact)
  }
  return new TextEncoder().encode(text)
}

const SAMPLE = 'd8:announce16:http://tracker/x4:infod4:name5:hello6:lengthi1024eee'

const tool: Tool = {
  slug: 'bencode',
  name: 'Bencode Decoder',
  description: 'Decode bencode (BitTorrent) payloads into a readable tree.',
  category: 'Data',
  keywords: ['bencode', 'bittorrent', 'torrent', 'decode', 'binary', 'metainfo', 'serialization'],
  render(root) {
    let format: 'text' | 'hex' | 'base64' = 'text'
    const input = textarea({ rows: 8, onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    let treeText = ''
    const tree = outputBlock('', { label: 'Decoded tree', copy: () => treeText })
    let jsonText = ''
    const json = outputBlock('', { label: 'JSON view', copy: () => jsonText })
    const counters = stats()
    const renderCounters = (bytes: number, rest: number) => {
      counters.replaceChildren(
        stat({ label: 'Input', value: `${bytes} B` }),
        stat({ label: 'Trailing', value: `${rest} B` }),
      )
    }
    const notes = note('')
    notes.hidden = true

    const formatControl = segmented({
      label: 'Input format',
      value: format,
      items: [
        { value: 'text', label: 'Text' },
        { value: 'hex', label: 'Hex' },
        { value: 'base64', label: 'Base64' },
      ],
      onChange: (value) => {
        format = value as 'text' | 'hex' | 'base64'
        run()
      },
    })

    function run() {
      treeText = ''
      jsonText = ''
      tree.body.replaceChildren()
      json.body.replaceChildren()
      try {
        const bytes = parsePayload(input.value, format)
        const { value, rest } = decode(bytes)
        treeText = formatTree(value)
        tree.body.replaceChildren(treeText)
        tree.setMeta(`${bytes.length} bytes`)
        const collected: string[] = []
        jsonText = JSON.stringify(toJson(value, collected), null, 2)
        json.body.replaceChildren(jsonText)
        json.setMeta('')
        renderCounters(bytes.length, rest)
        const shown = uniqueNotes(collected)
        notes.textContent = shown.join(' ')
        notes.hidden = shown.length === 0
        error.hidden = true
      } catch (err) {
        renderCounters(0, 0)
        error.textContent = err instanceof BencodeError ? err.message : 'Could not decode that payload.'
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
          field(input, { label: 'Bencoded payload' }),
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
        note('Bencode byte strings are not always text. Binary strings show as a byte count and hex in the tree, and as { $hex } in the JSON view. Integers beyond the safe range stay exact in the tree.'),
      ),
    )

    input.value = SAMPLE
    run()
  },
}

export default tool
