import {
  actions,
  button,
  download,
  field,
  note,
  outputBlock,
  panel,
  segmented,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { generateMany, type IdFormat } from './id'

const FORMATS: { value: IdFormat; label: string; hint: string }[] = [
  { value: 'uuid-v4', label: 'UUID v4', hint: 'Random 128-bit identifier' },
  { value: 'uuid-v7', label: 'UUID v7', hint: 'Time-ordered, sortable UUID' },
  { value: 'ulid', label: 'ULID', hint: 'Time-ordered, Crockford base32' },
  { value: 'nanoid', label: 'Nano ID', hint: 'URL-safe 21-character id' },
  { value: 'hex', label: 'Hex', hint: '16 random bytes as hex' },
  { value: 'objectid', label: 'ObjectId', hint: 'MongoDB-style 24-char id' },
]

const tool: Tool = {
  slug: 'id-generator',
  name: 'ID Generator',
  description: 'Generate UUIDs, ULIDs, Nano IDs, hex ids and ObjectIds.',
  category: 'Data',
  keywords: ['uuid', 'v4', 'v7', 'ulid', 'nanoid', 'objectid', 'guid', 'identifier'],
  render(root) {
    let format: IdFormat = 'uuid-v4'
    const count = textField({ type: 'number', value: '5', mono: true, onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    const list = outputBlock('', { label: 'Identifiers', copy: () => list.body.textContent ?? '' })
    const hint = el('p', { class: 'ts-k-hint' })

    const picker = segmented({
      label: 'Identifier format',
      value: format,
      items: FORMATS.map((item) => ({ value: item.value, label: item.label, hint: item.hint })),
      onChange: (value) => {
        format = value as IdFormat
        run()
      },
    })

    function run() {
      try {
        const values = generateMany(format, Number(count.value) || 1)
        list.body.replaceChildren(...values.map((value) => el('div', {}, value)))
        error.hidden = true
        hint.textContent = FORMATS.find((item) => item.value === format)?.hint ?? ''
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not generate ids.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Format', icon: 'hash' },
          picker,
          actions(
            field(count, { label: 'How many', grow: true }),
            button('Generate', { variant: 'primary', icon: 'refresh', onClick: run }),
          ),
          error,
          hint,
        ),
        list,
        actions(button('Download .txt', {
          icon: 'download',
          onClick: () => download('ids.txt', list.body.textContent ?? ''),
        })),
              ),
    )

    run()
  },
}

export default tool
