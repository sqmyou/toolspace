import {
  actions,
  button,
  copyButton,
  download,
  field,
  note,
  outputBlock,
  panel,
  segmented,
  stat,
  stats as statStrip,
  textField,
  textarea,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { fromJsonArray, parseJsonLines, pluckField, reformat, stats as lineStats, toJsonArray } from './jsonl'

const SAMPLE = '{"id":1,"name":"Ada","active":true}\n{"id":2,"name":"Linus","active":false}\n{"id":3,"name":"Grace","active":true}'

const MODES = [
  { value: 'validate', label: 'Validate' },
  { value: 'array', label: 'Lines → array' },
  { value: 'lines', label: 'Array → lines' },
  { value: 'compact', label: 'Compact' },
  { value: 'pretty', label: 'Pretty' },
  { value: 'pluck', label: 'Pick a field' },
]

const tool: Tool = {
  slug: 'json-lines',
  name: 'JSON Lines Tool',
  description: 'Validate, convert and inspect newline-delimited JSON.',
  category: 'Data',
  keywords: ['json', 'jsonl', 'ndjson', 'lines', 'convert', 'validate', 'array'],
  render(root) {
    let mode = 'validate'
    const input = textarea({ rows: 10, value: SAMPLE, onInput: () => run() })
    const fieldName = textField({ value: 'name', mono: true, onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    const summary = statStrip()
    let result = ''
    const output = outputBlock('', { label: 'Output', copy: () => result })

    const modeControl = segmented({
      label: 'Mode',
      value: mode,
      items: MODES.map((item) => ({ value: item.value, label: item.label })),
      onChange: (value) => {
        mode = value
        run()
      },
    })

    function run() {
      error.hidden = true
      try {
        const parsed = parseJsonLines(input.value)
        const counts = lineStats(input.value)
        summary.replaceChildren(
          stat({ label: 'Values', value: String(counts.valid) }),
          stat({ label: 'Invalid lines', value: String(counts.invalid) }),
          stat({ label: 'Blank lines', value: String(counts.blank) }),
          stat({ label: 'Fields', value: String(counts.fields.length) }),
        )

        if (parsed.errors.length) {
          error.textContent = `${parsed.errors.length} line${parsed.errors.length === 1 ? '' : 's'} could not be parsed (first at line ${parsed.errors[0].line}).`
          error.hidden = false
        }

        switch (mode) {
          case 'array':
            result = toJsonArray(input.value)
            break
          case 'lines':
            result = fromJsonArray(input.value)
            break
          case 'compact':
            result = reformat(input.value, 0)
            break
          case 'pretty':
            result = reformat(input.value, 2)
            break
          case 'pluck':
            result = pluckField(input.value, fieldName.value)
              .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
              .join('\n')
            break
          default:
            result = parsed.errors.length ? '' : input.value
        }
        output.body.replaceChildren(result)
        output.setMeta(result ? `${result.split('\n').length} lines` : '')
      } catch (err) {
        result = ''
        output.body.replaceChildren('')
        output.setMeta('')
        error.textContent = err instanceof Error ? err.message : 'Could not process that input.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Input', icon: 'text' },
          field(modeControl, { label: 'Mode' }),
          field(fieldName, { label: 'Field to pick' }),
          input,
          error,
        ),
        summary,
        output,
        actions(
          copyButton(() => result, { label: 'Copy output' }),
          button('Download .jsonl', {
            icon: 'download',
            onClick: () => download('data.jsonl', result, 'text/plain'),
          }),
        ),
        note('One JSON value per line, blank lines skipped. Bad lines are listed by number while the good ones still convert.'),
      ),
    )

    run()
  },
}

export default tool
