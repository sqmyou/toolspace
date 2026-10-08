import {
  actions,
  button,
  checkbox,
  field,
  grid,
  note,
  outputBlock,
  panel,
  segmented,
  stat,
  stats,
  table,
  textarea,
  textField,
  toolLayout,
} from '../../core/components'
import { download } from '../../core/ui'
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
    let format: 'csv' | 'json' = 'csv'

    const count = textField({ value: '10', type: 'number', onInput: () => run() })
    count.min = '1'
    count.max = '500'
    const seed = textField({ value: '42', type: 'number', onInput: () => run() })

    const formatControl = segmented({
      label: 'Output format',
      items: [
        { value: 'csv', label: 'CSV' },
        { value: 'json', label: 'JSON' },
      ],
      value: format,
      onChange: (value) => {
        format = value as 'csv' | 'json'
        run()
      },
    })

    const fieldGrid = grid(150)
    for (const [key, label] of Object.entries(FIELD_LABELS) as [FieldKey, string][]) {
      fieldGrid.append(
        checkbox({
          label,
          checked: selected.has(key),
          onChange: (checked) => {
            if (checked) selected.add(key)
            else selected.delete(key)
            run()
          },
        }),
      )
    }

    const preview = document.createElement('div')
    const previewPanel = panel({ title: 'Preview', icon: 'eye' }, preview)

    const outputArea = textarea({ rows: 10, readonly: true })
    const output = outputBlock('', { label: 'CSV', copy: () => outputArea.value })
    output.body.replaceChildren(outputArea)

    const figure = stats()

    function run() {
      const fields = [...selected]
      if (fields.length === 0) {
        preview.replaceChildren(note('Choose at least one field.', 'warn'))
        outputArea.value = ''
        output.setMeta( '')
        figure.replaceChildren()
        return
      }
      const rows = generateRows({ fields, count: Number(count.value) || 1, seed: Number(seed.value) || 0 })
      outputArea.value = format === 'csv' ? toCsv(rows) : toJson(rows)
      output.setLabel(format === 'csv' ? 'CSV' : 'JSON')
      output.setMeta( `${rows.length} row${rows.length === 1 ? '' : 's'}`)
      figure.replaceChildren(
        stat({ label: 'Rows', value: String(rows.length) }),
        stat({ label: 'Fields', value: String(fields.length) }),
        stat({ label: 'Seed', value: seed.value || '0' }),
      )
      renderPreview(rows, fields)
    }

    function renderPreview(rows: Record<string, string>[], fields: FieldKey[]) {
      const columns = fields.map((field) => ({ key: field, label: FIELD_LABELS[field] }))
      const nodes: Node[] = [table(columns, rows.slice(0, 20))]
      if (rows.length > 20) nodes.push(note(`Showing the first 20 of ${rows.length} rows.`))
      preview.replaceChildren(...nodes)
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Fields', icon: 'sliders' },
          fieldGrid,
        ),
        panel(
          { title: 'Rows', icon: 'hash' },
          grid(130, field(count, { label: 'How many' }), field(seed, { label: 'Seed' }), field(formatControl, { label: 'Format' })),
          actions(button('Regenerate', { icon: 'refresh', variant: 'primary', onClick: () => run() })),
        ),
        figure,
        previewPanel,
        output,
        actions(
          button('Download', {
            icon: 'download',
            onClick: () =>
              download(
                format === 'csv' ? 'fake-data.csv' : 'fake-data.json',
                outputArea.value,
                format === 'csv' ? 'text/csv' : 'application/json',
              ),
          }),
        ),
        note('All names and companies are invented. Email addresses use reserved example domains, so nothing can reach a real inbox.'),
      ),
    )

    run()
  },
}

export default tool
