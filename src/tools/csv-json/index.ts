import {
  actions,
  button,
  checkbox,
  field,
  note,
  outputBlock,
  panel,
  select,
  textarea,
  toolLayout,
} from '../../core/components'
import { download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { csvToJson, detectDelimiter, jsonToCsv, parseCsv, type Delimiter } from './csv'

const tool: Tool = {
  slug: 'csv-json',
  name: 'CSV ↔ JSON Converter',
  description: 'Convert between CSV and JSON with delimiter sniffing and full quoting support.',
  category: 'Data',
  keywords: ['csv', 'json', 'convert', 'delimiter', 'table', 'tsv', 'parse'],
  render(root) {
    const input = textarea({ rows: 10, placeholder: 'Paste CSV or JSON…', onInput: () => run() })

    const error = note('', 'danger')
    error.hidden = true

    const outputArea = textarea({ rows: 10, readonly: true })
    const output = outputBlock('', { label: 'Output', copy: () => outputArea.value })
    output.body.replaceChildren(outputArea)
    const meta = output.querySelector('.ts-k-out__meta') as HTMLElement

    const delimiter = select({
      options: [
        { value: 'auto', label: 'Auto-detect' },
        { value: ',', label: 'Comma ,' },
        { value: ';', label: 'Semicolon ;' },
        { value: '\t', label: 'Tab' },
        { value: '|', label: 'Pipe |' },
      ],
      value: 'auto',
      onChange: () => run(),
    })

    let hasHeader = true
    const headerBox = checkbox({ label: 'First row is a header', checked: true, onChange: (checked) => { hasHeader = checked; run() } })

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.csv,.tsv,.txt,.json'
    fileInput.className = 'ts-k-input'
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]
      if (!file) return
      input.value = await file.text()
      run()
    })

    function guessIsJson(text: string): boolean {
      const trimmed = text.trim()
      return trimmed.startsWith('{') || trimmed.startsWith('[')
    }

    function run() {
      const text = input.value
      if (!text.trim()) {
        outputArea.value = ''
        error.hidden = true
        meta.textContent = ''
        output.setLabel('Output')
        return
      }

      if (guessIsJson(text)) {
        const separator: Delimiter = delimiter.value === 'auto' ? ',' : (delimiter.value as Delimiter)
        const { csv, error: jsonError } = jsonToCsv(text, separator)
        outputArea.value = csv
        error.hidden = !jsonError
        error.textContent = jsonError ?? ''
        output.setLabel('CSV')
        const lines = csv.trim() ? csv.trim().split('\n').length : 0
        meta.textContent = lines ? `${lines} line${lines === 1 ? '' : 's'}` : ''
      } else {
        const separator: Delimiter = delimiter.value === 'auto' ? detectDelimiter(text) : (delimiter.value as Delimiter)
        const parsed = csvToJson(text, { delimiter: separator, hasHeader })
        outputArea.value = JSON.stringify(parsed, null, 2)
        error.hidden = true
        output.setLabel('JSON')
        const rows = parseCsv(text, separator).length
        meta.textContent = `${rows} row${rows === 1 ? '' : 's'} · ${separator === '\t' ? 'tab' : separator}`
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Options', icon: 'sliders' },
          actions(field(delimiter, { label: 'Delimiter' }), headerBox),
        ),
        panel({ title: 'Input', icon: 'braces' }, input, field(fileInput, { label: 'Or load a file' })),
        error,
        output,
        actions(
          button('Download', {
            icon: 'download',
            onClick: () => {
              const trimmed = outputArea.value.trim()
              const json = trimmed.startsWith('[') || trimmed.startsWith('{')
              download(json ? 'data.json' : 'data.csv', outputArea.value, json ? 'application/json' : 'text/csv')
            },
          }),
        ),
        note('Conversion happens in your browser; nothing is uploaded.'),
      ),
    )

    run()
  },
}

export default tool
