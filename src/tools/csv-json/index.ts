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
import { csvToJson, csvToMarkdown, detectDelimiter, jsonToCsv, markdownToCsv, type Delimiter } from './csv'

const tool: Tool = {
  slug: 'csv-json',
  name: 'CSV ↔ JSON Converter',
  description: 'Convert between CSV, JSON and Markdown tables with delimiter sniffing and full quoting support.',
  category: 'Data',
  keywords: ['csv', 'json', 'convert', 'delimiter', 'table', 'tsv', 'parse', 'markdown', 'markdown table'],
  render(root) {
    const input = textarea({ rows: 10, placeholder: 'Paste CSV, JSON or a Markdown table…', onInput: () => run() })

    const error = note('', 'danger')
    error.hidden = true

    const outputArea = textarea({ rows: 10, readonly: true })
    const output = outputBlock('', { label: 'Output', copy: () => outputArea.value })
    output.body.replaceChildren(outputArea)
    

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

    let outputFormat: 'auto' | 'json' | 'csv' | 'markdown' = 'auto'
    const formatControl = select({
      options: [
        { value: 'auto', label: 'Auto' },
        { value: 'json', label: 'JSON' },
        { value: 'csv', label: 'CSV' },
        { value: 'markdown', label: 'Markdown table' },
      ],
      value: 'auto',
      onChange: (value) => {
        outputFormat = value as typeof outputFormat
        run()
      },
    })

    let hasHeader = true
    const headerBox = checkbox({ label: 'First row is a header', checked: true, onChange: (checked) => { hasHeader = checked; run() } })

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.csv,.tsv,.txt,.json,.md'
    fileInput.className = 'ts-k-input'
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]
      if (!file) return
      input.value = await file.text()
      run()
    })

    type Source = 'json' | 'markdown' | 'csv'

    function detectSource(text: string): Source {
      const trimmed = text.trim()
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
      if (/^\s*\|/.test(trimmed)) return 'markdown'
      return 'csv'
    }

    function separator(): Delimiter {
      return delimiter.value === 'auto' ? ',' : (delimiter.value as Delimiter)
    }

    function show(value: string, errorText: string | undefined, label: string, meta: string) {
      outputArea.value = value
      error.hidden = !errorText
      error.textContent = errorText ?? ''
      output.setLabel(label)
      output.setMeta(errorText ? '' : meta)
    }

    function toJson(text: string, source: Source): { value: string; error?: string } {
      if (source === 'json') return { value: JSON.stringify(JSON.parse(text), null, 2) }
      if (source === 'markdown') {
        const { csv, error } = markdownToCsv(text, separator())
        if (error) return { value: '', error }
        return { value: JSON.stringify(csvToJson(csv, { hasHeader }), null, 2) }
      }
      return { value: JSON.stringify(csvToJson(text, { delimiter: delimiter.value === 'auto' ? detectDelimiter(text) : separator(), hasHeader }), null, 2) }
    }

    function toCsv(text: string, source: Source): { value: string; error?: string } {
      if (source === 'markdown') {
        const { csv, error } = markdownToCsv(text, separator())
        return { value: csv, error }
      }
      if (source === 'json') {
        const { csv, error } = jsonToCsv(text, separator())
        return { value: csv, error }
      }
      return { value: text }
    }

    function toMarkdown(text: string, source: Source): { value: string; error?: string } {
      if (source === 'markdown') return { value: text }
      if (source === 'json') {
        const { csv, error } = jsonToCsv(text, separator())
        if (error) return { value: '', error }
        return { value: csvToMarkdown(csv, { delimiter: separator(), hasHeader }) }
      }
      const sep = delimiter.value === 'auto' ? detectDelimiter(text) : separator()
      return { value: csvToMarkdown(text, { delimiter: sep, hasHeader }) }
    }

    function run() {
      const text = input.value
      if (!text.trim()) {
        outputArea.value = ''
        error.hidden = true
        output.setMeta('')
        output.setLabel('Output')
        return
      }

      const source = detectSource(text)
      const target: 'json' | 'csv' | 'markdown' =
        outputFormat === 'auto'
          ? source === 'json'
            ? 'csv'
            : source === 'csv'
              ? 'json'
              : 'csv'
          : (outputFormat as 'json' | 'csv' | 'markdown')

      const labels = { json: 'JSON', csv: 'CSV', markdown: 'Markdown' }
      try {
        const { value, error: convertError } =
          target === 'json' ? toJson(text, source) : target === 'csv' ? toCsv(text, source) : toMarkdown(text, source)
        const lineCount = value.trim() ? value.trim().split('\n').length : 0
        const meta = lineCount ? `${lineCount} ${target === 'json' ? 'lines' : 'rows'}` : ''
        show(value, convertError, labels[target], meta)
      } catch (err) {
        show('', err instanceof Error ? err.message : 'Could not convert that input.', labels[target], '')
      }
    }


    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Options', icon: 'sliders' },
          actions(
            field(delimiter, { label: 'Delimiter' }),
            field(formatControl, { label: 'Output format' }),
            headerBox,
          ),
        ),
        panel({ title: 'Input', icon: 'braces' }, input, field(fileInput, { label: 'Or load a file' })),
        error,
        output,
        actions(
          button('Download', {
            icon: 'download',
            onClick: () => {
              const trimmed = outputArea.value.trim()
              const isJson = trimmed.startsWith('[') || trimmed.startsWith('{')
              const isMarkdown = output.getLabel() === 'Markdown'
              const name = isJson ? 'data.json' : isMarkdown ? 'table.md' : 'data.csv'
              const mime = isJson ? 'application/json' : isMarkdown ? 'text/markdown' : 'text/csv'
              download(name, outputArea.value, mime)
            },
          }),
        ),
      ),
    )

    run()
  },
}

export default tool
