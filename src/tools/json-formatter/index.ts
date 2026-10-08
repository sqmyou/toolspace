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
import { download, readFileAsText } from '../../core/ui'
import type { Tool } from '../../core/types'
import { formatJson, jsonStats, parseJson, sortJsonValue, validateJson } from './json'

const tool: Tool = {
  slug: 'json-formatter',
  name: 'JSON Formatter & Validator',
  description: 'Prettify, minify, validate and sort JSON, with the exact line of any syntax error.',
  category: 'Data',
  keywords: ['json', 'format', 'pretty', 'beautify', 'minify', 'validate', 'lint', 'sort'],
  render(root) {
    const input = textarea({ rows: 12, placeholder: 'Paste JSON…' })

    let indent: number | '\t' = 2
    let sortKeys = false
    let value: unknown = null
    let valid = false

    const indentSelect = select({
      value: '2',
      options: [
        { value: '2', label: '2 spaces' },
        { value: '4', label: '4 spaces' },
        { value: 'tab', label: 'Tab' },
        { value: '0', label: 'Minify' },
      ],
      onChange: (next) => {
        indent = next === 'tab' ? '\t' : Number(next)
        if (valid) output.setValue(pretty())
      },
    })

    const sortToggle = checkbox({
      label: 'Sort keys',
      onChange: (checked) => {
        sortKeys = checked
        if (valid) output.setValue(pretty())
      },
    })

    const error = note('', 'danger')
    error.hidden = true
    const output = outputBlock('', { label: 'Output', copy: () => pretty() })
    output.hidden = true

    function pretty(): string {
      if (!valid) return ''
      return formatJson(sortKeys ? sortJsonValue(value) : value, indent)
    }

    function run() {
      const text = input.value
      if (!text.trim()) {
        error.hidden = true
        output.hidden = true
        valid = false
        return
      }
      const issue = validateJson(text)
      if (issue) {
        valid = false
        output.hidden = true
        error.textContent = issue.line
          ? `Invalid JSON — ${issue.message} (line ${issue.line}, column ${issue.column})`
          : `Invalid JSON — ${issue.message}`
        error.hidden = false
        return
      }
      valid = true
      value = parseJson(text)
      error.hidden = true
      output.hidden = false
      output.setValue(pretty())
      const info = jsonStats(value, text)
      output.setLabel(`Valid · ${info.nodes} values · depth ${info.depth} · ${info.bytes} bytes`)
    }

    input.addEventListener('input', run)

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.json,application/json,text/plain'
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]
      if (!file) return
      input.value = await readFileAsText(file)
      run()
    })

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'JSON', icon: 'braces' },
          input,
          actions(
            field(indentSelect, { label: 'Indent', grow: false }),
            sortToggle,
            button('Load a file', { icon: 'upload', onClick: () => fileInput.click() }),
            button('Download', {
              icon: 'download',
              onClick: () => download('formatted.json', pretty(), 'application/json'),
            }),
          ),
        ),
        error,
        output,
        note('Your JSON is parsed in the browser and never uploaded.'),
      ),
    )

    run()
  },
}

export default tool
