import {
  actions,
  button,
  checkbox,
  note,
  outputBlock,
  panel,
  segmented,
  table,
  textarea,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { codePoints, decode, encode, namedEntities, stripTags } from './entities'

const tool: Tool = {
  slug: 'html-entities',
  name: 'HTML Entity Encoder',
  description: 'Escape and unescape HTML entities, with a character inspector for the result.',
  category: 'Web',
  keywords: ['html', 'entity', 'escape', 'unescape', 'entities', 'amp', 'nbsp', 'code point'],
  render(root) {
    let direction: 'encode' | 'decode' = 'encode'
    let quotes = true
    let all = false
    let strip = false
    let result = ''

    const directionControl = segmented({
      label: 'Direction',
      items: [
        { value: 'encode', label: 'Escape', hint: 'text → entities' },
        { value: 'decode', label: 'Unescape', hint: 'entities → text' },
      ],
      value: direction,
      onChange: (value) => {
        direction = value as 'encode' | 'decode'
        run()
      },
    })

    const optionsPanel = panel(
      { title: 'Options', icon: 'sliders' },
      directionControl,
      actions(
        checkbox({ label: 'Escape quotes', checked: true, onChange: (checked) => { quotes = checked; run() } }),
        checkbox({ label: 'Escape all non-ASCII', onChange: (checked) => { all = checked; run() } }),
        checkbox({ label: 'Strip tags when decoding', onChange: (checked) => { strip = checked; run() } }),
        button('Swap', {
          icon: 'swap',
          onClick: () => {
            direction = direction === 'encode' ? 'decode' : 'encode'
            directionControl.setValue(direction)
            input.value = outputArea.value || input.value
            run()
          },
        }),
      ),
    )

    const input = textarea({ rows: 6, value: '<p class="note">Tom & Jerry</p>', onInput: () => run() })
    const outputArea = textarea({ rows: 6, readonly: true })
    const output = outputBlock('', { label: 'Entities', copy: () => outputArea.value })
    output.body.replaceChildren(outputArea)

    const error = note('', 'danger')
    error.hidden = true

    const characters = panel({ title: 'Characters', icon: 'type', meta: 'first 200' })
    const names = panel({ title: 'Named entities', icon: 'star' })
    characters.body.classList.add('ts-entity-table')
    names.body.classList.add('ts-entity-table')
    const inspectorHost = characters.body
    const namedHost = names.body

    function run() {
      try {
        result = direction === 'encode' ? encode(input.value, { quotes, all }) : decode(input.value)
        outputArea.value = strip && direction === 'decode' ? stripTags(input.value) : result
        output.setLabel(direction === 'encode' ? 'Entities' : 'Plain text')
        output.setMeta(result ? `${result.length} characters` : '')
        error.hidden = true

        const rows = codePoints(result).slice(0, 200)
        inspectorHost.replaceChildren(
          table(
            [
              { key: 'char', label: 'Char' },
              { key: 'code', label: 'Code point', mono: true },
              { key: 'entity', label: 'Entity', mono: true },
            ],
            rows.map((row) => ({
              char: row.char === ' ' ? '␠' : row.char,
              code: `U+${row.codePoint.toString(16).toUpperCase().padStart(4, '0')}`,
              entity: row.entity,
            })),
          ),
        )

        const found = namedEntities(result)
        if (found.length === 0) {
          namedHost.replaceChildren(note('No named entities in the output.'))
        } else {
          namedHost.replaceChildren(
            table(
              [
                { key: 'char', label: 'Char' },
                { key: 'name', label: 'Name' },
                { key: 'entity', label: 'Entity', mono: true },
              ],
              found.map((row) => ({ char: row.char, name: row.name ?? '', entity: row.entity })),
            ),
          )
        }
      } catch (err) {
        result = ''
        outputArea.value = ''
        output.setMeta('')
        inspectorHost.replaceChildren()
        namedHost.replaceChildren()
        error.textContent = err instanceof Error ? err.message : 'Could not process that input.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        optionsPanel,
        panel({ title: 'Input', icon: 'code' }, input),
        error,
        output,
        characters,
        names,
        note('Only the characters that break HTML are escaped by default, so accented text stays readable. Decoding also understands &#169; and &#xA9; style references.'),
      ),
    )

    run()
  },
}

export default tool
