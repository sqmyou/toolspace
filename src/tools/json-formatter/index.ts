import { el } from '../../core/dom'
import { copyChip, download, readFileAsText } from '../../core/ui'
import type { Tool } from '../../core/types'
import { formatJson, jsonStats, parseJson, sortJsonValue, validateJson } from './json'

const tool: Tool = {
  slug: 'json-formatter',
  name: 'JSON Formatter & Validator',
  description: 'Prettify, minify, validate and sort JSON, with the exact line of any syntax error.',
  category: 'Data',
  keywords: ['json', 'format', 'pretty', 'beautify', 'minify', 'validate', 'lint', 'sort'],
  render(root) {
    const input = el('textarea', {
      class: 'ts-textarea ts-mono',
      rows: 12,
      spellcheck: false,
      placeholder: 'Paste JSON…',
    }) as HTMLTextAreaElement

    const output = el('pre', { class: 'ts-json-block' })
    const error = el('p', { class: 'ts-error', hidden: true })
    const stats = el('p', { class: 'ts-muted' })

    let indent: number | '\t' = 2
    let sortKeys = false
    let value: unknown = null
    let valid = false

    const indentSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const [label, option] of [['2 spaces', '2'], ['4 spaces', '4'], ['Tab', 'tab'], ['Minify', '0']] as const) {
      indentSelect.append(el('option', { value: option }, label))
    }
    const sortToggle = el('input', { type: 'checkbox' }) as HTMLInputElement

    function pretty(): string {
      if (!valid) return ''
      const target = sortKeys ? sortJsonValue(value) : value
      return formatJson(target, indent)
    }

    function run() {
      const text = input.value
      if (!text.trim()) {
        error.hidden = true
        output.textContent = ''
        stats.textContent = ''
        valid = false
        return
      }
      const issue = validateJson(text)
      if (issue) {
        valid = false
        output.textContent = ''
        stats.textContent = ''
        error.textContent = issue.line
          ? `Invalid JSON — ${issue.message} (line ${issue.line}, column ${issue.column})`
          : `Invalid JSON — ${issue.message}`
        error.hidden = false
        return
      }
      valid = true
      value = parseJson(text)
      error.hidden = true
      output.textContent = pretty()
      const info = jsonStats(value, text)
      stats.textContent = `${info.nodes} values · depth ${info.depth} · ${info.bytes} bytes in`
    }

    indentSelect.addEventListener('change', () => {
      indent = indentSelect.value === 'tab' ? '\t' : Number(indentSelect.value)
      if (valid) output.textContent = pretty()
    })
    sortToggle.addEventListener('change', () => {
      sortKeys = sortToggle.checked
      if (valid) output.textContent = pretty()
    })
    input.addEventListener('input', run)

    const fileInput = el('input', { type: 'file', accept: '.json,application/json,text/plain' }) as HTMLInputElement
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
          { class: 'ts-row ts-wrap ts-between' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Indent'), indentSelect),
          el('label', { class: 'ts-inline-field' }, sortToggle, 'Sort keys'),
          el('div', { class: 'ts-field ts-grow' }, el('label', {}, 'Load a file'), fileInput),
        ),
        el('div', { class: 'ts-field' }, el('label', {}, 'Input'), input),
        error,
        stats,
        el(
          'div',
          { class: 'ts-row ts-between' },
          el('h3', { class: 'ts-subhead' }, 'Output'),
          el(
            'div',
            { class: 'ts-tool-actions' },
            copyChip(pretty, 'Copy'),
            el('button', { class: 'ts-button', type: 'button', onclick: () => download('formatted.json', pretty(), 'application/json') }, 'Download'),
          ),
        ),
        output,
        el('p', { class: 'ts-note' }, 'Your JSON is parsed in the browser and never uploaded.'),
      ),
    )

    run()
  },
}

export default tool
