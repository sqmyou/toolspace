import { el } from '../../core/dom'
import { copyChip, download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { csvToJson, jsonToCsv, type JsonValue } from './csv'

const JSON_SAMPLE = JSON.stringify(
  [
    { name: 'Ada', score: 10, tags: ['maths', 'logic'] },
    { name: 'Grace', score: 20, tags: ['compilers'] },
  ],
  null,
  2,
)

const CSV_SAMPLE = 'name,score,tags\nAda,10,maths\nGrace,20,compilers\n'

const tool: Tool = {
  slug: 'json-to-csv',
  name: 'JSON ↔ CSV Converter',
  description: 'Convert JSON arrays of objects to CSV and back, flattening nested values.',
  category: 'Data',
  keywords: ['json', 'csv', 'convert', 'export', 'spreadsheet', 'excel', 'table', 'flatten'],
  render(root) {
    const direction = el(
      'select',
      { class: 'ts-select' },
      el('option', { value: 'json2csv' }, 'JSON → CSV'),
      el('option', { value: 'csv2json' }, 'CSV → JSON'),
    ) as HTMLSelectElement
    const delimiter = el('input', { class: 'ts-input ts-mono', value: ',', maxlength: 3, 'aria-label': 'Delimiter' }) as HTMLInputElement
    const quoteAll = el('input', { type: 'checkbox' }) as HTMLInputElement

    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 14, spellcheck: false }) as HTMLTextAreaElement
    const output = el('textarea', { class: 'ts-textarea ts-mono', rows: 14, spellcheck: false, readonly: true }) as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const summary = el('p', { class: 'ts-muted' })
    let result = ''

    function sample() {
      input.value = direction.value === 'json2csv' ? JSON_SAMPLE : CSV_SAMPLE
    }

    function run() {
      const sep = delimiter.value || ','
      try {
        if (direction.value === 'json2csv') {
          const parsed = JSON.parse(input.value) as JsonValue
          const converted = jsonToCsv(parsed, { delimiter: sep, quoteAll: quoteAll.checked })
          result = converted.csv
          summary.textContent = `${converted.rowCount} rows · ${converted.columns.length} columns`
        } else {
          const rows = csvToJson(input.value, sep)
          result = JSON.stringify(rows, null, 2)
          summary.textContent = `${rows.length} rows`
        }
        output.value = result
        error.hidden = true
      } catch (err) {
        result = ''
        output.value = ''
        summary.textContent = ''
        error.textContent = err instanceof Error ? err.message : 'Could not convert that input.'
        error.hidden = false
      }
    }

    direction.addEventListener('change', () => {
      sample()
      run()
    })
    delimiter.addEventListener('input', run)
    quoteAll.addEventListener('change', run)
    input.addEventListener('input', run)

    const extension = () => (direction.value === 'json2csv' ? 'csv' : 'json')

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Direction'), direction),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Delimiter'), delimiter),
          el('label', { class: 'ts-inline-field' }, quoteAll, 'Quote every field'),
          el('button', { class: 'ts-button', type: 'button', onclick: sample }, 'Load sample'),
        ),
        el('div', { class: 'ts-two-col' }, el('div', { class: 'ts-field' }, el('label', {}, 'Input'), input), el('div', { class: 'ts-field' }, el('label', {}, 'Output'), output)),
        error,
        el('div', { class: 'ts-row ts-between' }, summary, el('div', { class: 'ts-tool-actions' }, copyChip(() => result, 'Copy'), el('button', { class: 'ts-button', type: 'button', onclick: () => download(`data.${extension()}`, result, 'text/plain') }, 'Download'))),
        el('p', { class: 'ts-note' }, 'Nested objects become dotted column names and arrays are joined with "; ". Numeric-looking CSV cells come back as numbers.'),
      ),
    )

    sample()
    run()
  },
}

export default tool
