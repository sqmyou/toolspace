import {
  actions,
  field,
  note,
  outputBlock,
  panel,
  select,
  textarea,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { DEFAULT_FORMAT_OPTIONS, DIALECTS, formatSql, SqlFormatError, type Dialect, type FormatOptions } from './sql'

const EXAMPLE = 'select u.id, u.name, count(o.id) as orders from users u left join orders o on o.user_id = u.id where u.active = true group by u.id order by orders desc limit 10;'

const tool: Tool = {
  slug: 'sql-formatter',
  name: 'SQL Formatter',
  description: 'Prettify SQL queries. Supports MySQL, PostgreSQL, SQLite, BigQuery and more.',
  category: 'Data',
  keywords: ['sql', 'format', 'beautify', 'pretty', 'query', 'postgres', 'mysql'],
  render(root) {
    const options: FormatOptions = { ...DEFAULT_FORMAT_OPTIONS }

    const input = textarea({ rows: 8, value: EXAMPLE, placeholder: 'Paste SQL here…', onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    const output = outputBlock('', { label: 'Formatted SQL', copy: () => output.body.textContent ?? '' })

    function run() {
      const sql = input.value
      formatSql(sql, options)
        .then((formatted) => {
          // Ignore stale results if the user kept typing while the library loaded.
          if (input.value !== sql) return
          output.body.replaceChildren(formatted)
          output.setMeta('')
          error.hidden = true
        })
        .catch((err) => {
          if (input.value !== sql) return
          output.body.replaceChildren('')
          output.setMeta('')
          error.textContent = err instanceof SqlFormatError ? err.message : 'Could not format this SQL.'
          error.hidden = false
        })
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Query', icon: 'code' },
          actions(
            field(
              select({
                value: options.dialect,
                options: DIALECTS.map((value) => ({ value, label: value })),
                onChange: (value) => {
                  options.dialect = value as Dialect
                  run()
                },
              }),
              { label: 'Dialect' },
            ),
            field(
              select({
                value: options.keywordCase,
                options: ['upper', 'lower', 'preserve'].map((value) => ({ value, label: value })),
                onChange: (value) => {
                  options.keywordCase = value as FormatOptions['keywordCase']
                  run()
                },
              }),
              { label: 'Keywords' },
            ),
          ),
          field(input, { label: 'Input' }),
          error,
        ),
        output,
              ),
    )

    run()
  },
}

export default tool
