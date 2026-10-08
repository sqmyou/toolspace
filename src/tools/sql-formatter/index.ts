import { el } from '../../core/dom'
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

    const input = el('textarea', {
      class: 'ts-output ts-textarea',
      rows: 8,
      spellcheck: false,
      placeholder: 'Paste SQL here…',
      value: EXAMPLE,
    }) as HTMLTextAreaElement

    const output = el('textarea', {
      class: 'ts-output ts-textarea',
      rows: 12,
      readonly: true,
      spellcheck: false,
      'aria-label': 'Formatted SQL',
    }) as HTMLTextAreaElement

    const status = el('p', { class: 'ts-error', hidden: true })

    function select(label: string, values: readonly string[], current: string, onChange: (v: string) => void) {
      const node = el('select', {
        class: 'ts-select',
        onchange: (e: Event) => onChange((e.target as HTMLSelectElement).value),
      }) as HTMLSelectElement
      for (const value of values) {
        node.append(el('option', { value, selected: value === current }, value))
      }
      return el('label', { class: 'ts-inline-field' }, el('span', {}, label), node)
    }

    function run() {
      const sql = input.value
      formatSql(sql, options)
        .then((formatted) => {
          // Ignore stale results if the user kept typing while the library loaded.
          if (input.value !== sql) return
          output.value = formatted
          status.hidden = true
        })
        .catch((error) => {
          if (input.value !== sql) return
          output.value = ''
          status.textContent = error instanceof SqlFormatError ? error.message : 'Could not format this SQL.'
          status.hidden = false
        })
    }

    async function copy() {
      if (!output.value) return
      try {
        await navigator.clipboard.writeText(output.value)
        copyButton.textContent = 'Copied'
        setTimeout(() => (copyButton.textContent = 'Copy'), 1200)
      } catch {
        output.select()
      }
    }

    const copyButton = el('button', { class: 'ts-button', onclick: copy }, 'Copy')

    input.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          select('Dialect', DIALECTS, options.dialect, (v) => {
            options.dialect = v as Dialect
            run()
          }),
          select('Keywords', ['upper', 'lower', 'preserve'], options.keywordCase, (v) => {
            options.keywordCase = v as FormatOptions['keywordCase']
            run()
          }),
        ),
        el('div', { class: 'ts-field' }, el('label', {}, 'Input'), input),
        el('div', { class: 'ts-row ts-between' }, el('label', { class: 'ts-muted' }, 'Formatted'), copyButton),
        output,
        status,
        el('p', { class: 'ts-note' }, 'Formatting happens entirely in your browser. Your queries are never uploaded.'),
      ),
    )

    run()
  },
}

export default tool
