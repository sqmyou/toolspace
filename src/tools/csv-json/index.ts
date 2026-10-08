import { el } from '../../core/dom'
import { copyChip, download, readFileAsText } from '../../core/ui'
import type { Tool } from '../../core/types'
import { csvToJson, detectDelimiter, jsonToCsv, parseCsv, type Delimiter } from './csv'

const tool: Tool = {
  slug: 'csv-json',
  name: 'CSV ↔ JSON Converter',
  description: 'Convert between CSV and JSON with delimiter sniffing and full quoting support.',
  category: 'Data',
  keywords: ['csv', 'json', 'convert', 'delimiter', 'table', 'tsv', 'parse'],
  render(root) {
    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 10, placeholder: 'Paste CSV or JSON…', 'aria-label': 'Input' }) as HTMLTextAreaElement
    const output = el('textarea', { class: 'ts-textarea ts-mono', rows: 10, readonly: true, 'aria-label': 'Output' }) as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const status = el('span', { class: 'ts-muted' })
    const fileInput = el('input', { type: 'file', accept: '.csv,.tsv,.txt,.json' }) as HTMLInputElement

    const delimiterSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const [value, label] of [['auto', 'Auto-detect'], [',', 'Comma ,'], [';', 'Semicolon ;'], ['\t', 'Tab'], ['|', 'Pipe |']] as const) {
      delimiterSelect.append(el('option', { value }, label))
    }

    const headerBox = el('input', { type: 'checkbox', checked: true }) as HTMLInputElement

    function guessIsJson(text: string): boolean {
      const trimmed = text.trim()
      return trimmed.startsWith('{') || trimmed.startsWith('[')
    }

    function run() {
      const text = input.value
      if (!text.trim()) {
        output.value = ''
        error.hidden = true
        status.textContent = ''
        return
      }

      if (guessIsJson(text)) {
        const delimiter: Delimiter = delimiterSelect.value === 'auto' ? ',' : (delimiterSelect.value as Delimiter)
        const { csv, error: jsonError } = jsonToCsv(text, delimiter)
        output.value = csv
        error.hidden = !jsonError
        error.textContent = jsonError ?? ''
        status.textContent = 'JSON → CSV'
      } else {
        const delimiter: Delimiter = delimiterSelect.value === 'auto' ? detectDelimiter(text) : (delimiterSelect.value as Delimiter)
        const parsed = csvToJson(text, { delimiter, hasHeader: headerBox.checked })
        output.value = JSON.stringify(parsed, null, 2)
        error.hidden = true
        status.textContent = `CSV → JSON · delimiter “${delimiter === '\t' ? 'tab' : delimiter}” · ${parseCsv(text, delimiter).length} rows`
      }
    }

    input.addEventListener('input', run)
    delimiterSelect.addEventListener('change', run)
    headerBox.addEventListener('change', run)

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]
      if (!file) return
      input.value = await readFileAsText(file)
      run()
    })

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Delimiter'), delimiterSelect),
          el('label', { class: 'ts-inline-field' }, headerBox, 'First row is a header'),
          fileInput,
        ),
        el('div', { class: 'ts-two-col' },
          el('div', { class: 'ts-field' }, el('label', {}, 'Input'), input),
          el('div', { class: 'ts-field' }, el('label', {}, 'Output'), output),
        ),
        error,
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          status,
          copyChip(() => output.value, 'Copy output'),
          el('button', {
            class: 'ts-button',
            type: 'button',
            onclick: () => {
              const json = output.value.trim().startsWith('[') || output.value.trim().startsWith('{')
              download(json ? 'data.json' : 'data.csv', output.value, json ? 'application/json' : 'text/csv')
            },
          }, 'Download'),
        ),
        el('p', { class: 'ts-note' }, 'Conversion happens in your browser; nothing is uploaded.'),
      ),
    )

    run()
  },
}

export default tool
