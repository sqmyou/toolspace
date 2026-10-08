import { el } from '../../core/dom'
import { copyChip, download } from '../../core/ui'
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
    const count = el('input', { class: 'ts-input', type: 'number', min: '1', max: '1000', value: '5' }) as HTMLInputElement
    const list = el('textarea', { class: 'ts-textarea ts-mono', rows: 10, readonly: true }) as HTMLTextAreaElement
    const hint = el('p', { class: 'ts-hint' })
    const error = el('p', { class: 'ts-error', hidden: true })

    const select = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const item of FORMATS) select.append(el('option', { value: item.value }, item.label))
    select.addEventListener('change', () => {
      format = select.value as IdFormat
      run()
    })

    function run() {
      try {
        const values = generateMany(format, Number(count.value) || 1)
        list.value = values.join('\n')
        error.hidden = true
        hint.textContent = FORMATS.find((item) => item.value === format)?.hint ?? ''
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not generate ids.'
        error.hidden = false
      }
    }

    count.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Format'), select),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'How many'), count),
          el('button', { class: 'ts-button ts-primary', type: 'button', onclick: run }, 'Generate'),
        ),
        error,
        hint,
        list,
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          copyChip(() => list.value, 'Copy all'),
          el('button', {
            class: 'ts-button',
            type: 'button',
            onclick: () => download('ids.txt', list.value),
          }, 'Download'),
        ),
        el('p', { class: 'ts-note' }, 'Identifiers are generated with the browser’s cryptographically secure random source.'),
      ),
    )

    run()
  },
}

export default tool
