import {
  actions,
  button,
  checkbox,
  copyButton,
  copyRow,
  field,
  grid,
  kvList,
  note,
  panel,
  select,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { randomBetween, randomHex, randomPassword, randomToken, type CharSetName } from './random'

const SET_LABELS: [CharSetName, string][] = [
  ['lower', 'a-z'],
  ['upper', 'A-Z'],
  ['digits', '0-9'],
  ['symbols', 'Symbols'],
]

const tool: Tool = {
  slug: 'crypto-random',
  name: 'Random Generator',
  description: 'Cryptographically random numbers, bytes, hex, tokens and passwords.',
  category: 'Security',
  keywords: ['random', 'crypto', 'password', 'token', 'hex', 'bytes', 'secure', 'entropy', 'nonce'],
  render(root) {
    let kind = 'number'
    const min = textField({ type: 'number', value: '1', mono: true, onInput: () => generate() })
    const max = textField({ type: 'number', value: '100', mono: true, onInput: () => generate() })
    const length = textField({ type: 'number', value: '16', mono: true, onInput: () => generate() })
    const count = textField({ type: 'number', value: '5', mono: true, onInput: () => generate() })
    let requireEach = true
    const setState: Record<string, boolean> = { lower: true, upper: true, digits: true, symbols: true }
    const error = note('', 'danger')
    error.hidden = true
    const list = kvList()
    let values: string[] = []

    const kindControl = select({
      options: [
        { value: 'number', label: 'Number in a range' },
        { value: 'bytes', label: 'Random bytes (hex)' },
        { value: 'token', label: 'URL-safe token' },
        { value: 'password', label: 'Password' },
      ],
      value: 'number',
      onChange: (value) => {
        kind = value
        controlGroup()
        generate()
      },
    })

    const setsRow = el(
      'div',
      { class: 'ts-k-actions' },
      ...SET_LABELS.map(([name, label]) =>
        checkbox({ label, checked: true, onChange: (checked) => { setState[name] = checked; generate() } }),
      ),
    )
    const rangeFields = el('div', { class: 'ts-k-grid' }, field(min, { label: 'Min' }), field(max, { label: 'Max' }))
    const lengthField = field(length, { label: 'Length / bytes' })
    const passwordExtras = el(
      'div',
      { class: 'ts-k-actions' },
      checkbox({ label: 'Require one of each selected set', checked: true, onChange: (checked) => { requireEach = checked; generate() } }),
    )

    function controlGroup() {
      rangeFields.hidden = kind !== 'number'
      lengthField.hidden = kind === 'number'
      setsRow.hidden = kind !== 'password'
      passwordExtras.hidden = kind !== 'password'
    }

    function generate() {
      list.replaceChildren()
      try {
        const total = Math.max(1, Math.min(20, Number(count.value) || 1))
        values = []
        for (let i = 0; i < total; i++) {
          if (kind === 'number') values.push(String(randomBetween(Number(min.value) || 0, Number(max.value) || 0)))
          else if (kind === 'bytes') values.push(randomHex(Number(length.value) || 16))
          else if (kind === 'token') values.push(randomToken(Number(length.value) || 16))
          else {
            const sets = SET_LABELS.filter(([name]) => setState[name]).map(([name]) => name)
            values.push(randomPassword({ length: Number(length.value) || 16, sets, requireEach }))
          }
        }
        list.replaceChildren(...values.map((value, index) => copyRow(`#${index + 1}`, value)))
        error.hidden = true
      } catch (err) {
        values = []
        error.textContent = err instanceof Error ? err.message : 'Could not generate that.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        {},
        panel(
          { title: 'What to generate', icon: 'wand' },
          grid(180, field(kindControl, { label: 'Type' }), field(count, { label: 'How many' })),
          rangeFields,
          lengthField,
          setsRow,
          passwordExtras,
          error,
        ),
        panel(
          { title: 'Results', icon: 'bolt' },
          actions(button('Generate', { variant: 'primary', icon: 'refresh', onClick: generate }), copyButton(() => values.join('\n'), { label: 'Copy all' })),
          list,
        ),
        note('Values come from crypto.getRandomValues with rejection sampling, so every result in the range is equally likely. Nothing is sent anywhere.'),
      ),
    )

    controlGroup()
    generate()
  },
}

export default tool
