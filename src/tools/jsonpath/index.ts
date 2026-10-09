import {
  actions,
  chips,
  copyButton,
  field,
  note,
  outputBlock,
  panel,
  textarea,
  textField,
  toolLayout,
} from '../../core/components'
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
    const docInput = textarea({ rows: 14, value: SAMPLE, onInput: () => run() })
    const path = textField({ value: '$.store.book[*].title', mono: true, onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    const summary = note('')
    let output = ''
    const result = outputBlock('(no matches)', { label: 'Matches', copy: () => output })

    function run() {
      try {
        const document = JSON.parse(docInput.value) as JsonValue
        const matches = query(document, path.value)
        output = matches.length ? JSON.stringify(matches.map((match) => ({ path: match.path, value: match.value })), null, 2) : ''
        result.body.replaceChildren(matches.length ? output : '(no matches)')
        result.setMeta(`${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`)
        summary.textContent = ''
        error.hidden = true
      } catch (err) {
        output = ''
        result.body.replaceChildren('')
        result.setMeta('')
        error.textContent = err instanceof Error ? err.message : 'Could not run that query.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Document', icon: 'code' },
          field(docInput, { label: 'JSON document' }),
        ),
        panel(
          { title: 'Query', icon: 'search' },
          field(path, { label: 'JSONPath' }),
          chips(EXAMPLES.map((example) => ({ label: example, onClick: () => {
            path.value = example
            run()
          } }))),
          actions(copyButton(() => output, { label: 'Copy results', size: 'sm' })),
          error,
          summary,
        ),
        result,
        note('Supports child, wildcard, recursive descent, slices and filters. Filters use a fixed comparison grammar and never execute code.'),
      ),
    )

    run()
  },
}

export default tool
