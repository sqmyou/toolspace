import {
  actions,
  button,
  checkbox,
  copyButton,
  field,
  grid,
  note,
  outputBlock,
  panel,
  select,
  segmented,
  textarea,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { detectDelimiter, fromMarkdownTable, parseCsv, TableError, toCsv, toMarkdownTable } from './table'
import type { Alignment, Delimiter } from './table'

const CSV_SAMPLE = `name,role,city
Ada Lovelace,Engineer,London
Grace Hopper,"Rear Admiral, USN",New York
Alan Turing,Mathematician,London
`

const MD_SAMPLE = `| name          | role               | city     |
| ------------- | ------------------ | -------- |
| Ada Lovelace  | Engineer           | London   |
| Grace Hopper  | Rear Admiral, USN  | New York |
| Alan Turing   | Mathematician      | London   |
`

const delimiterOptions = [
  { value: 'auto', label: 'Auto-detect' },
  { value: ',', label: 'Comma (,)' },
  { value: '\t', label: 'Tab' },
  { value: ';', label: 'Semicolon (;)' },
  { value: '|', label: 'Pipe (|)' },
]

const alignmentOptions = [
  { value: 'none', label: 'Default' },
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
]

const tool: Tool = {
  slug: 'csv-markdown',
  name: 'CSV ↔ Markdown Table',
  description: 'Convert CSV to a GitHub-flavoured Markdown table, and back again.',
  category: 'Data',
  keywords: ['csv', 'markdown', 'table', 'convert', 'github', 'tsv', 'pipe', 'align'],
  render(root) {
    let direction: 'csv2md' | 'md2csv' = 'csv2md'
    let delimiter = 'auto'
    let trim = true
    let alignment: Alignment = 'none'

    const input = textarea({ rows: 12, onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    let result = ''
    const output = outputBlock('', { label: 'Markdown', copy: () => result })

    const directionControl = segmented({
      label: 'Direction',
      value: direction,
      items: [
        { value: 'csv2md', label: 'CSV → Markdown' },
        { value: 'md2csv', label: 'Markdown → CSV' },
      ],
      onChange: (value) => {
        direction = value as 'csv2md' | 'md2csv'
        sample()
        paint()
        run()
      },
    })

    const delimiterControl = field(
      select({
        options: delimiterOptions,
        value: delimiter,
        onChange: (value) => {
          delimiter = value
          run()
        },
      }),
      { label: 'CSV delimiter' },
    )

    const alignmentControl = field(
      select({
        options: alignmentOptions,
        value: alignment,
        onChange: (value) => {
          alignment = value as Alignment
          run()
        },
      }),
      { label: 'Column alignment' },
    )

    const trimControl = checkbox({
      label: 'Trim header cells',
      checked: trim,
      onChange: (checked) => {
        trim = checked
        run()
      },
    })

    function sample() {
      input.value = direction === 'csv2md' ? CSV_SAMPLE : MD_SAMPLE
    }

    function paint() {
      delimiterControl.hidden = direction !== 'csv2md'
      alignmentControl.hidden = direction !== 'csv2md'
      trimControl.hidden = direction !== 'md2csv'
      output.setLabel(direction === 'csv2md' ? 'Markdown' : 'CSV')
    }

    function run() {
      try {
        let rows: string[][]
        if (direction === 'csv2md') {
          const used: Delimiter = delimiter === 'auto' ? detectDelimiter(input.value) : (delimiter as Delimiter)
          rows = parseCsv(input.value, used)
          result = toMarkdownTable(rows, rows[0]?.map(() => alignment) ?? [])
          output.setMeta(`${rows.length} row(s) × ${rows[0]?.length ?? 0} column(s)`)
        } else {
          rows = fromMarkdownTable(input.value)
          if (trim) rows = rows.map((row) => row.map((cell) => cell.trim()))
          result = toCsv(rows)
          output.setMeta(`${rows.length} row(s)`)
        }
        output.body.replaceChildren(result)
        error.hidden = true
      } catch (err) {
        result = ''
        output.body.replaceChildren('')
        output.setMeta('')
        error.textContent = err instanceof TableError ? err.message : 'Could not convert that input.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Convert', icon: 'refresh' },
          directionControl,
          actions(
            button('Load sample', { icon: 'refresh', onClick: () => { sample(); paint(); run() } }),
            copyButton(() => result, { label: 'Copy result', size: 'sm' }),
          ),
          grid(200, delimiterControl, alignmentControl),
          trimControl,
          grid(320, field(input, { label: 'Input' }), field(output, { label: 'Output' })),
          error,
        ),
        note('Cells with a newline become <br> in Markdown and are restored on the way back. A literal pipe is escaped so it cannot split a row.'),
      ),
    )

    sample()
    paint()
    run()
  },
}

export default tool
