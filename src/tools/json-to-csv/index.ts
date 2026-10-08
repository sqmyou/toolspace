import {
  actions,
  button,
  checkbox,
  field,
  note,
  outputBlock,
  panel,
  segmented,
  textarea,
  textField,
  toolLayout,
} from '../../core/components'
import { download } from '../../core/ui'
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
    let direction = 'json2csv'

    const directionControl = segmented({
      label: 'Direction',
      items: [
        { value: 'json2csv', label: 'JSON → CSV' },
        { value: 'csv2json', label: 'CSV → JSON' },
      ],
      value: direction,
      onChange: (value) => {
        direction = value
        sample()
        run()
      },
    })

    const delimiter = textField({ value: ',', mono: true, onInput: () => run() })
    delimiter.maxLength = 3
    delimiter.setAttribute('aria-label', 'Delimiter')

    let quoteAll = false
    const quoteAllBox = checkbox({
      label: 'Quote every field',
      onChange: (checked) => {
        quoteAll = checked
        run()
      },
    })

    const input = textarea({ rows: 14, onInput: () => run() })
    const outputArea = textarea({ rows: 14, readonly: true })
    const output = outputBlock('', { label: 'Output', copy: () => outputArea.value })
    output.body.replaceChildren(outputArea)
    

    const error = note('', 'danger')
    error.hidden = true

    let result = ''

    function sample() {
      input.value = direction === 'json2csv' ? JSON_SAMPLE : CSV_SAMPLE
    }

    function run() {
      const separator = delimiter.value || ','
      try {
        if (direction === 'json2csv') {
          const parsed = JSON.parse(input.value) as JsonValue
          const converted = jsonToCsv(parsed, { delimiter: separator, quoteAll })
          result = converted.csv
          output.setLabel('CSV')
          output.setMeta( `${converted.rowCount} row${converted.rowCount === 1 ? '' : 's'} · ${converted.columns.length} column${converted.columns.length === 1 ? '' : 's'}`)
        } else {
          const rows = csvToJson(input.value, separator)
          result = JSON.stringify(rows, null, 2)
          output.setLabel('JSON')
          output.setMeta( `${rows.length} row${rows.length === 1 ? '' : 's'}`)
        }
        outputArea.value = result
        error.hidden = true
      } catch (err) {
        result = ''
        outputArea.value = ''
        output.setMeta( '')
        error.textContent = err instanceof Error ? err.message : 'Could not convert that input.'
        error.hidden = false
      }
    }

    const extension = () => (direction === 'json2csv' ? 'csv' : 'json')

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Options', icon: 'sliders' },
          directionControl,
          actions(field(delimiter, { label: 'Delimiter' }), quoteAllBox),
        ),
        panel(
          { title: 'Input', icon: 'braces' },
          input,
          actions(button('Load sample', { icon: 'refresh', onClick: () => { sample(); run() } })),
        ),
        error,
        output,
        actions(
          button('Download', { icon: 'download', onClick: () => download(`data.${extension()}`, result, 'text/plain') }),
        ),
        note('Nested objects become dotted column names and arrays are joined with "; ". Numeric-looking CSV cells come back as numbers.'),
      ),
    )

    sample()
    run()
  },
}

export default tool
