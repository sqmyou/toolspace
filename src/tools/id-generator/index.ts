import {
  actions,
  button,
  copyRow,
  download,
  field,
  kvList,
  note,
  outputBlock,
  panel,
  segmented,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { generateMany, parseUuid, type IdFormat } from './id'

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
  description: 'Generate UUIDs, ULIDs, Nano IDs, hex ids and ObjectIds, and validate a UUID.',
  category: 'Data',
  keywords: ['uuid', 'v4', 'v7', 'ulid', 'nanoid', 'objectid', 'guid', 'identifier', 'validate', 'validate uuid'],
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

    const checkInput = textField({ placeholder: 'Paste a UUID to validate…', mono: true, onInput: () => check() })
    const checkError = note('', 'danger')
    checkError.hidden = true
    const checkRows = kvList()

    function check() {
      const result = parseUuid(checkInput.value)
      if (!result.valid) {
        checkRows.replaceChildren()
        checkError.textContent = result.error ?? 'Not a UUID.'
        checkError.hidden = false
        return
      }
      checkError.hidden = true
      const rows = [
        copyRow('Canonical', result.canonical),
        copyRow('Variant', result.variant ?? 'Unknown', { copy: false }),
      ]
      if (result.version != null) rows.push(copyRow('Version', String(result.version), { copy: false }))
      if (result.timestamp) rows.push(copyRow('Embedded time', result.timestamp.toISOString()))
      checkRows.replaceChildren(...rows)
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
        panel(
          { title: 'Validate a UUID', icon: 'check' },
          field(checkInput, { label: 'UUID', hint: 'Braces, a urn:uuid: prefix, upper case and the unhyphenated 32-character form all work.' }),
          checkError,
          checkRows,
        ),
              ),
    )

    run()
    check()
  },
}

export default tool
