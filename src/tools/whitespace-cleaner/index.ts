import {
  actions,
  button,
  checkbox,
  field,
  grid,
  note,
  outputBlock,
  panel,
  stat,
  stats,
  textarea,
  textField,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { clean, inspect, type CleanOptions } from './whitespace'

const SAMPLE = `  function greet(name) {   \n\t\treturn "hi " + name;   \n  }  \n\n\n\n  greet("world");  `

interface Toggle {
  key: keyof CleanOptions
  label: string
  hint: string
}

const TOGGLES: Toggle[] = [
  { key: 'normalizeNewlines', label: 'Normalise line endings', hint: 'CRLF and CR become LF' },
  { key: 'tabsToSpaces', label: 'Tabs to spaces', hint: 'Expand tabs to the width below' },
  { key: 'collapseSpaces', label: 'Collapse spaces', hint: 'Runs of spaces become one' },
  { key: 'trimLines', label: 'Trim each line', hint: 'Remove leading and trailing space' },
  { key: 'removeEmptyLines', label: 'Remove empty lines', hint: 'Delete every blank line' },
  { key: 'joinLines', label: 'Join lines', hint: 'Merge everything into one paragraph' },
  { key: 'trimDocument', label: 'Trim document', hint: 'Remove space at the very start and end' },
]

const tool: Tool = {
  slug: 'whitespace-cleaner',
  name: 'Whitespace Cleaner',
  description: 'Trim, collapse and normalise whitespace, and see exactly which rules changed what.',
  category: 'Text',
  keywords: ['whitespace', 'trim', 'clean', 'tabs', 'spaces', 'crlf', 'blank lines', 'format'],
  render(root) {
    const input = textarea({ rows: 12, mono: true, value: SAMPLE, onInput: () => run() })
    const outputArea = textarea({ rows: 12, mono: true, readonly: true })
    const resultBlock = outputBlock(outputArea, { label: 'Cleaned output', copy: () => cleaned })

    const maxBlank = textField({ type: 'number', value: '1', mono: true, onInput: () => run() })
    const tabWidth = textField({ type: 'number', value: '4', mono: true, onInput: () => run() })

    const found = stats()
    const toggles: { control: HTMLInputElement; key: keyof CleanOptions }[] = []
    let cleaned = ''

    for (const toggle of TOGGLES) {
      const label = checkbox({
        label: toggle.label,
        hint: toggle.hint,
        checked: true,
        onChange: () => run(),
      })
      label.classList.add('ts-ws-rule')
      toggles.push({ key: toggle.key, control: label.querySelector('input') as HTMLInputElement })
    }

    function run() {
      const options: CleanOptions = {
        maxBlankLines: Number(maxBlank.value) || 0,
        tabWidth: Number(tabWidth.value) || 4,
      }
      for (const { key, control } of toggles) options[key] = control.checked as never
      const result = clean(input.value, options)
      cleaned = result.text
      outputArea.value = result.text
      resultBlock.setMeta(
        `${result.linesBefore} → ${result.linesAfter} lines · ${result.charactersRemoved} characters removed`,
      )

      const issues = inspect(input.value)
      const labels: [keyof typeof issues, string][] = [
        ['trailingWhitespace', 'lines with trailing space'],
        ['leadingWhitespace', 'lines with leading space'],
        ['tabs', 'tab characters'],
        ['crlf', 'CRLF endings'],
        ['multipleSpaces', 'runs of multiple spaces'],
        ['blankLines', 'blank lines'],
      ]
      found.replaceChildren(
        ...labels.map(([key, label]) => {
          const count = issues[key]
          return stat({ label, value: String(count), hint: count > 0 ? 'needs cleaning' : 'clean' })
        }),
      )
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Input', icon: 'text' },
          input,
          actions(
            button('Load sample', {
              icon: 'refresh',
              onClick: () => {
                input.value = SAMPLE
                run()
              },
            }),
            button('Clear', {
              icon: 'x',
              onClick: () => {
                input.value = ''
                run()
              },
            }),
          ),
        ),
        panel({ title: 'Detected', icon: 'eye' }, found),
        panel(
          { title: 'Rules', icon: 'sliders' },
          grid(230, ...toggles.map(({ control }) => control.closest('.ts-k-check') as HTMLElement)),
          actions(
            field(maxBlank, { label: 'Max blank lines', grow: true }),
            field(tabWidth, { label: 'Tab width', grow: true }),
          ),
        ),
        resultBlock,
        note('Rules run in a fixed order so the same input always gives the same output.'),
      ),
    )

    run()
  },
}

export default tool
