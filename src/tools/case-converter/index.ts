import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import {
  camelCase, constantCase, dotCase, kebabCase, lower, pascalCase, reverse,
  sentenceCase, snakeCase, titleCase, toggleCase, transformLines, upper,
} from './case'

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
    const input = el('textarea', {
      class: 'ts-textarea',
      rows: 6,
      placeholder: 'Paste or type text…',
      'aria-label': 'Input text',
    }) as HTMLTextAreaElement

    const results = el('div', { class: 'ts-copy-list' })

    const trim = el('input', { type: 'checkbox' }) as HTMLInputElement
    const sort = el('input', { type: 'checkbox' }) as HTMLInputElement
    const dedupe = el('input', { type: 'checkbox' }) as HTMLInputElement
    const reverseLines = el('input', { type: 'checkbox' }) as HTMLInputElement
    const linesOut = el('textarea', { class: 'ts-textarea', rows: 4, readonly: true }) as HTMLTextAreaElement

    function renderResults() {
      results.replaceChildren(
        ...TRANSFORMS.map((transform) =>
          el(
            'div',
            { class: 'ts-copy-row' },
            el('span', { class: 'ts-muted' }, transform.label),
            copyChip(() => transform.run(input.value)),
          ),
        ),
      )
    }

    function renderLines() {
      linesOut.value = transformLines(input.value, {
        trim: trim.checked,
        sort: sort.checked,
        dedupe: dedupe.checked,
        reverse: reverseLines.checked,
      })
    }

    input.addEventListener('input', () => {
      renderResults()
      renderLines()
    })
    for (const box of [trim, sort, dedupe, reverseLines]) box.addEventListener('change', renderLines)

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Input'), input),
        el('h3', { class: 'ts-subhead' }, 'Converted'),
        results,
        el('h3', { class: 'ts-subhead' }, 'Line tools'),
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('label', { class: 'ts-inline-field' }, trim, 'Trim & drop blanks'),
          el('label', { class: 'ts-inline-field' }, sort, 'Sort'),
          el('label', { class: 'ts-inline-field' }, dedupe, 'Dedupe'),
          el('label', { class: 'ts-inline-field' }, reverseLines, 'Reverse'),
        ),
        el('div', { class: 'ts-field' }, linesOut),
        el('p', { class: 'ts-note' }, 'Everything is transformed locally in your browser.'),
      ),
    )

    renderResults()
    renderLines()
  },
}

export default tool
