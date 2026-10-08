import { el } from '../../core/dom'
import { copyChip, download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { fromJsonArray, parseJsonLines, pluckField, reformat, stats, toJsonArray } from './jsonl'

const SAMPLE = '{"id":1,"name":"Ada","active":true}\n{"id":2,"name":"Linus","active":false}\n{"id":3,"name":"Grace","active":true}'

const tool: Tool = {
  slug: 'json-lines',
  name: 'JSON Lines Tool',
  description: 'Validate, convert and inspect newline-delimited JSON.',
  category: 'Data',
  keywords: ['json', 'jsonl', 'ndjson', 'lines', 'convert', 'validate', 'array'],
  render(root) {
    const mode = el(
      'select',
      { class: 'ts-select' },
      el('option', { value: 'validate' }, 'Validate'),
      el('option', { value: 'array' }, 'Lines → JSON array'),
      el('option', { value: 'lines' }, 'JSON array → Lines'),
      el('option', { value: 'compact' }, 'Compact each line'),
      el('option', { value: 'pretty' }, 'Pretty each line'),
      el('option', { value: 'pluck' }, 'Pick a field'),
    ) as HTMLSelectElement
    const fieldName = el('input', { class: 'ts-input ts-mono', value: 'name' }) as HTMLInputElement
    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 10, spellcheck: false }, SAMPLE) as HTMLTextAreaElement
    const output = el('textarea', { class: 'ts-textarea ts-mono', rows: 10, spellcheck: false, readonly: true }) as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const report = el('div', { class: 'ts-copy-list' })
    let result = ''

    function run() {
      error.hidden = true
      report.replaceChildren()
      try {
        const parsed = parseJsonLines(input.value)
        const summary = stats(input.value)
        const rows: [string, string][] = [
          ['Values', String(summary.valid)],
          ['Invalid lines', String(summary.invalid)],
          ['Blank lines', String(summary.blank)],
          ['Fields', summary.fields.join(', ') || '—'],
          ['Types', Object.entries(summary.types).map(([type, count]) => `${type}: ${count}`).join(', ') || '—'],
        ]
        for (const [label, value] of rows) report.append(el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted ts-jsonl-name' }, label), el('code', { class: 'ts-jsonl-value' }, value)))

        if (parsed.errors.length) {
          error.textContent = `${parsed.errors.length} line${parsed.errors.length === 1 ? '' : 's'} could not be parsed (first at line ${parsed.errors[0].line}).`
          error.hidden = false
        }

        switch (mode.value) {
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
            result = pluckField(input.value, fieldName.value).map((value) => (typeof value === 'string' ? value : JSON.stringify(value))).join('\n')
            break
          default:
            result = parsed.errors.length ? '' : input.value
        }
        output.value = result
      } catch (err) {
        result = ''
        output.value = ''
        error.textContent = err instanceof Error ? err.message : 'Could not process that input.'
        error.hidden = false
      }
    }

    for (const node of [mode, fieldName]) node.addEventListener('input', run)
    input.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-row ts-wrap' }, el('div', { class: 'ts-inline-field' }, el('label', {}, 'Mode'), mode), el('div', { class: 'ts-inline-field ts-grow' }, el('label', {}, 'Field to pick'), fieldName)),
        el('div', { class: 'ts-field' }, el('label', {}, 'Input'), input),
        error,
        el('div', { class: 'ts-field' }, el('label', {}, 'Output'), output),
        el('div', { class: 'ts-row ts-wrap' }, copyChip(() => result, 'Copy output'), el('button', { class: 'ts-button', type: 'button', onclick: () => download('data.jsonl', result, 'text/plain') }, 'Download')),
        report,
        el('p', { class: 'ts-note' }, 'One JSON value per line, blank lines skipped. Bad lines are listed by number while the good ones still convert.'),
      ),
    )

    run()
  },
}

export default tool
