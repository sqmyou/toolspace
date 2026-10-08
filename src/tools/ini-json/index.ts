import { el } from '../../core/dom'
import { copyChip, download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { parseIni, toIni } from './ini'

const INI_SAMPLE = `title = demo app

[server]
host = localhost
port = 8080
workers = 4

[database]
url = postgres://localhost/app
pool = 10
`

const JSON_SAMPLE = JSON.stringify(
  {
    title: 'demo app',
    server: { host: 'localhost', port: 8080, workers: 4 },
    database: { url: 'postgres://localhost/app', pool: 10 },
  },
  null,
  2,
)

const tool: Tool = {
  slug: 'ini-json',
  name: 'INI ↔ JSON Converter',
  description: 'Convert between INI config files and JSON, with warnings for malformed lines.',
  category: 'Data',
  keywords: ['ini', 'json', 'convert', 'config', 'conf', 'cfg', 'toml-ish', 'settings'],
  render(root) {
    const direction = el(
      'select',
      { class: 'ts-select' },
      el('option', { value: 'ini2json' }, 'INI → JSON'),
      el('option', { value: 'json2ini' }, 'JSON → INI'),
    ) as HTMLSelectElement

    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 16, spellcheck: false }) as HTMLTextAreaElement
    const output = el('textarea', { class: 'ts-textarea ts-mono', rows: 16, spellcheck: false, readonly: true }) as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const warnings = el('ul', { class: 'ts-ini-warnings' })
    let result = ''

    function sample() {
      input.value = direction.value === 'ini2json' ? INI_SAMPLE : JSON_SAMPLE
    }

    function run() {
      warnings.replaceChildren()
      try {
        if (direction.value === 'ini2json') {
          const parsed = parseIni(input.value)
          result = JSON.stringify(parsed.data, null, 2)
          for (const warning of parsed.warnings) warnings.append(el('li', {}, warning))
        } else {
          const parsed = JSON.parse(input.value) as Record<string, unknown>
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('The top level must be a JSON object')
          result = toIni(parsed)
        }
        output.value = result
        error.hidden = true
      } catch (err) {
        result = ''
        output.value = ''
        error.textContent = err instanceof Error ? err.message : 'Could not convert that input.'
        error.hidden = false
      }
    }

    direction.addEventListener('change', () => {
      sample()
      run()
    })
    input.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-row ts-wrap' }, el('div', { class: 'ts-inline-field' }, el('label', {}, 'Direction'), direction), el('button', { class: 'ts-button', type: 'button', onclick: sample }, 'Load sample')),
        el('div', { class: 'ts-two-col' }, el('div', { class: 'ts-field' }, el('label', {}, 'Input'), input), el('div', { class: 'ts-field' }, el('label', {}, 'Output'), output)),
        error,
        el('div', { class: 'ts-row ts-between' }, el('span', { class: 'ts-muted' }, 'Warnings'), el('div', { class: 'ts-tool-actions' }, copyChip(() => result, 'Copy'), el('button', { class: 'ts-button', type: 'button', onclick: () => download(direction.value === 'ini2json' ? 'config.json' : 'config.ini', result) }, 'Download'))),
        warnings,
        el('p', { class: 'ts-note' }, 'Only whole-line comments are ignored, so a "#" inside a value is kept. Conversion happens locally.'),
      ),
    )

    sample()
    run()
  },
}

export default tool
