import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { query, type JsonValue } from './jsonpath'

const SAMPLE = JSON.stringify(
  {
    store: {
      book: [
        { title: 'Refactoring', price: 30, tags: ['code', 'craft'] },
        { title: 'Clean Code', price: 20, tags: ['code'] },
        { title: 'The Art', price: 45, tags: [] },
      ],
      bicycle: { color: 'red', price: 120 },
    },
    cheap: true,
  },
  null,
  2,
)

const EXAMPLES = ['$.store.book[*].title', '$..price', '$.store.book[?(@.price < 30)]', '$.store.book[0:2]', '$..tags[0]']

const tool: Tool = {
  slug: 'jsonpath',
  name: 'JSONPath Query',
  description: 'Run JSONPath queries against a document and inspect every match with its path.',
  category: 'Data',
  keywords: ['jsonpath', 'json', 'query', 'filter', 'select', 'jmespath', 'extract'],
  render(root) {
    const docInput = el('textarea', { class: 'ts-textarea ts-mono', rows: 14, spellcheck: false }) as HTMLTextAreaElement
    docInput.value = SAMPLE
    const pathInput = el('input', { class: 'ts-input ts-mono', value: '$.store.book[*].title', 'aria-label': 'JSONPath' }) as HTMLInputElement
    const result = el('pre', { class: 'ts-pre ts-jsonpath-out' })
    const error = el('p', { class: 'ts-error', hidden: true })
    const summary = el('p', { class: 'ts-muted' })
    const examples = el('div', { class: 'ts-jsonpath-examples' })
    let output = ''

    function run() {
      try {
        const document = JSON.parse(docInput.value) as JsonValue
        const matches = query(document, pathInput.value)
        output = JSON.stringify(
          matches.map((match) => ({ path: match.path, value: match.value })),
          null,
          2,
        )
        result.textContent = matches.length ? output : '(no matches)'
        summary.textContent = `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`
        error.hidden = true
      } catch (err) {
        output = ''
        result.textContent = ''
        summary.textContent = ''
        error.textContent = err instanceof Error ? err.message : 'Could not run that query.'
        error.hidden = false
      }
    }

    for (const example of EXAMPLES) {
      examples.append(el('button', { class: 'ts-button ts-jsonpath-example', type: 'button', onclick: () => { pathInput.value = example; run() } }, example))
    }

    docInput.addEventListener('input', run)
    pathInput.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Document'), docInput),
        el('div', { class: 'ts-row ts-wrap' }, el('div', { class: 'ts-inline-field ts-grow' }, el('label', {}, 'JSONPath'), pathInput), el('div', { class: 'ts-inline-field' }, el('label', {}, ' '), copyChip(() => output, 'Copy results'))),
        el('div', { class: 'ts-row ts-wrap' }, el('span', { class: 'ts-muted' }, 'Examples:'), examples),
        error,
        summary,
        result,
        el('p', { class: 'ts-note' }, 'Supports child, wildcard, recursive descent, slices and filters. Filters use a fixed comparison grammar and never execute code.'),
      ),
    )

    run()
  },
}

export default tool
