import {
  actions,
  button,
  checkbox,
  copyButton,
  note,
  outputBlock,
  panel,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import {
  camelCase, constantCase, dotCase, kebabCase, lower, pascalCase, reverse,
  sentenceCase, snakeCase, titleCase, toggleCase, transformLines, upper,
} from './case'

const SAMPLE = 'the Quick brown FOX jumps over the lazy dog'

const TRANSFORMS: { label: string; run: (input: string) => string }[] = [
  { label: 'UPPER CASE', run: upper },
  { label: 'lower case', run: lower },
  { label: 'Sentence case', run: sentenceCase },
  { label: 'Title Case', run: titleCase },
  { label: 'camelCase', run: camelCase },
  { label: 'PascalCase', run: pascalCase },
  { label: 'snake_case', run: snakeCase },
  { label: 'kebab-case', run: kebabCase },
  { label: 'CONSTANT_CASE', run: constantCase },
  { label: 'dot.case', run: dotCase },
  { label: 'tOGGLE cASE', run: toggleCase },
  { label: 'esreveR', run: reverse },
]

const tool: Tool = {
  slug: 'case-converter',
  name: 'Case Converter & Text Transformer',
  description: 'Convert text between cases and clean up lines without leaving the page.',
  category: 'Text',
  keywords: ['case', 'uppercase', 'lowercase', 'camel', 'snake', 'kebab', 'title', 'sort lines', 'dedupe'],
  render(root) {
    const input = textarea({
      rows: 6,
      placeholder: 'Paste or type text…',
      mono: false,
      onInput: () => {
        renderResults()
        renderLines()
      },
    })

    const values = el('div', { class: 'ts-case-list' })
    const linesOut = textarea({ rows: 4, readonly: true, mono: false })
    const linesBlock = outputBlock(linesOut, { label: 'Cleaned lines', copy: () => linesOut.value })

    let trim = false
    let sort = false
    let dedupe = false
    let reverseLines = false

    function renderResults() {
      values.replaceChildren(
        ...TRANSFORMS.map((transform) =>
          el(
            'div',
            { class: 'ts-case-row' },
            el('span', { class: 'ts-case-row__label' }, transform.label),
            el('span', { class: 'ts-case-row__value ts-k-mono' }, transform.run(input.value) || '—'),
            copyButton(() => transform.run(input.value), { label: 'Copy', size: 'sm' }),
          ),
        ),
      )
    }

    function renderLines() {
      linesOut.value = transformLines(input.value, { trim, sort, dedupe, reverse: reverseLines })
    }

    function refresh() {
      renderResults()
      renderLines()
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
                refresh()
              },
            }),
            button('Clear', {
              icon: 'x',
              onClick: () => {
                input.value = ''
                refresh()
              },
            }),
          ),
        ),
        panel({ title: 'Converted', icon: 'type', flush: true }, values),
        panel(
          { title: 'Line tools', icon: 'sliders' },
          actions(
            checkbox({ label: 'Trim & drop blanks', onChange: (checked) => { trim = checked; renderLines() } }),
            checkbox({ label: 'Sort', onChange: (checked) => { sort = checked; renderLines() } }),
            checkbox({ label: 'Dedupe', onChange: (checked) => { dedupe = checked; renderLines() } }),
            checkbox({ label: 'Reverse', onChange: (checked) => { reverseLines = checked; renderLines() } }),
          ),
          linesBlock,
        ),
        note('Everything is transformed locally in your browser.'),
      ),
    )

    input.value = SAMPLE
    refresh()
  },
}

export default tool
