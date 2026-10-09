import {
  actions,
  button,
  copyButton,
  download,
  field,
  grid,
  note,
  outputBlock,
  panel,
  segmented,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
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
    let direction: 'ini2json' | 'json2ini' = 'ini2json'
    const input = textarea({ rows: 16, onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    const warnings = el('ul', { class: 'ts-ini-warnings' })
    let result = ''
    const output = outputBlock('', { label: 'Output', copy: () => result })

    const directionControl = segmented({
      label: 'Direction',
      value: direction,
      items: [
        { value: 'ini2json', label: 'INI → JSON' },
        { value: 'json2ini', label: 'JSON → INI' },
      ],
      onChange: (value) => {
        direction = value as 'ini2json' | 'json2ini'
        sample()
        run()
      },
    })

    function sample() {
      input.value = direction === 'ini2json' ? INI_SAMPLE : JSON_SAMPLE
    }

    function run() {
      warnings.replaceChildren()
      try {
        if (direction === 'ini2json') {
          const parsed = parseIni(input.value)
          result = JSON.stringify(parsed.data, null, 2)
          for (const warning of parsed.warnings) warnings.append(el('li', {}, warning))
        } else {
          const parsed = JSON.parse(input.value) as Record<string, unknown>
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('The top level must be a JSON object')
          result = toIni(parsed)
        }
        output.body.replaceChildren(result)
        output.setMeta(`${result.split('\n').length} lines`)
        error.hidden = true
      } catch (err) {
        result = ''
        output.body.replaceChildren('')
        output.setMeta('')
        error.textContent = err instanceof Error ? err.message : 'Could not convert that input.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Convert', icon: 'refresh' },
          directionControl,
          actions(button('Load sample', { icon: 'refresh', onClick: () => { sample(); run() } })),
          grid(320, field(input, { label: 'Input' }), field(output, { label: 'Output' })),
          error,
          warnings,
        ),
        actions(
          copyButton(() => result, { label: 'Copy' }),
          button('Download', {
            icon: 'download',
            onClick: () => download(direction === 'ini2json' ? 'config.json' : 'config.ini', result),
          }),
        ),
        note('Only whole-line comments are ignored, so a "#" inside a value is kept.'),
      ),
    )

    sample()
    run()
  },
}

export default tool
