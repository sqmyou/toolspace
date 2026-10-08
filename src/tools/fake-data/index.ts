import { el } from '../../core/dom'
import { copyChip, download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { FIELD_LABELS, generateRows, toCsv, toJson, type FieldKey } from './fake'

const DEFAULT_FIELDS: FieldKey[] = ['id', 'fullName', 'email', 'company', 'country']

const tool: Tool = {
  slug: 'fake-data',
  name: 'Fake Data Generator',
  description: 'Generate reproducible rows of synthetic people and company data as CSV or JSON.',
  category: 'Data',
  keywords: ['fake data', 'test data', 'fixtures', 'csv', 'json', 'seed', 'mock', 'sample data'],
  render(root) {
    const selected = new Set<FieldKey>(DEFAULT_FIELDS)
    const count = el('input', { class: 'ts-input', type: 'number', min: '1', max: '500', value: '10' }) as HTMLInputElement
    const seed = el('input', { class: 'ts-input', type: 'number', value: '42' }) as HTMLInputElement
    const preview = el('div', { class: 'ts-table-wrap' })
    const output = el('textarea', { class: 'ts-textarea ts-mono', rows: 10, readonly: true }) as HTMLTextAreaElement
    let format: 'csv' | 'json' = 'csv'

    const checkboxes = el('div', { class: 'ts-checkbox-grid' })
    for (const [key, label] of Object.entries(FIELD_LABELS) as [FieldKey, string][]) {
      const box = el('input', { type: 'checkbox', checked: selected.has(key) }) as HTMLInputElement
      box.addEventListener('change', () => {
        if (box.checked) selected.add(key)
        else selected.delete(key)
        run()
      })
      checkboxes.append(el('label', { class: 'ts-inline-field' }, box, label))
    }

    const formatSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    formatSelect.append(el('option', { value: 'csv' }, 'CSV'), el('option', { value: 'json' }, 'JSON'))
    formatSelect.addEventListener('change', () => {
      format = formatSelect.value as 'csv' | 'json'
      run()
    })

    function run() {
      const fields = [...selected]
      if (fields.length === 0) {
        preview.replaceChildren(el('p', { class: 'ts-muted' }, 'Choose at least one field.'))
        output.value = ''
        return
      }
      const rows = generateRows({ fields, count: Number(count.value) || 1, seed: Number(seed.value) || 0 })
      output.value = format === 'csv' ? toCsv(rows) : toJson(rows)
      renderPreview(rows, fields)
    }

    function renderPreview(rows: Record<string, string>[], fields: FieldKey[]) {
      const table = el('table', { class: 'ts-table' })
      const head = el('tr')
      for (const field of fields) head.append(el('th', {}, FIELD_LABELS[field]))
      table.append(el('thead', {}, head))
      const body = el('tbody')
      for (const row of rows.slice(0, 20)) {
        const tr = el('tr')
        for (const field of fields) tr.append(el('td', {}, row[field] ?? ''))
        body.append(tr)
      }
      table.append(body)
      const nodes: Node[] = [table]
      if (rows.length > 20) nodes.push(el('p', { class: 'ts-muted' }, `Showing 20 of ${rows.length} rows`))
      preview.replaceChildren(...nodes)
    }

    count.addEventListener('input', run)
    seed.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('h3', { class: 'ts-subhead' }, 'Fields'),
        checkboxes,
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Rows'), count),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Seed'), seed),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Format'), formatSelect),
          el('button', { class: 'ts-button ts-primary', type: 'button', onclick: run }, 'Regenerate'),
        ),
        el('h3', { class: 'ts-subhead' }, 'Preview'),
        preview,
        el('h3', { class: 'ts-subhead' }, 'Output'),
        output,
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          copyChip(() => output.value, 'Copy'),
          el('button', {
            class: 'ts-button',
            type: 'button',
            onclick: () => download(format === 'csv' ? 'fake-data.csv' : 'fake-data.json', output.value, format === 'csv' ? 'text/csv' : 'application/json'),
          }, 'Download'),
        ),
        el('p', { class: 'ts-note' }, 'All names and companies are invented. Email addresses use reserved example domains, so nothing can reach a real inbox.'),
      ),
    )

    run()
  },
}

export default tool
