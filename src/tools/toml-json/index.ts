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
import type { Tool } from '../../core/types'
import { parseToml, toToml } from './toml'

const TOML_SAMPLE = `title = "demo app"

[server]
host = "localhost"
port = 8080
tags = ["web", "api"]

[[roles]]
name = "admin"
level = 3
`

const JSON_SAMPLE = JSON.stringify(
  {
    title: 'demo app',
    server: { host: 'localhost', port: 8080, tags: ['web', 'api'] },
    roles: [{ name: 'admin', level: 3 }],
  },
  null,
  2,
)

const tool: Tool = {
  slug: 'toml-json',
  name: 'TOML ↔ JSON Converter',
  description: 'Convert between TOML config files and JSON, with specific errors for bad input.',
  category: 'Data',
  keywords: ['toml', 'json', 'convert', 'config', 'cargo', 'pyproject', 'settings'],
  render(root) {
    let direction: 'toml2json' | 'json2toml' = 'toml2json'
    const input = textarea({ rows: 16, onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    let result = ''
    const output = outputBlock('', { label: 'Output', copy: () => result })

    const directionControl = segmented({
      label: 'Direction',
      value: direction,
      items: [
        { value: 'toml2json', label: 'TOML → JSON' },
        { value: 'json2toml', label: 'JSON → TOML' },
      ],
      onChange: (value) => {
        direction = value as 'toml2json' | 'json2toml'
        sample()
        run()
      },
    })

    function sample() {
      input.value = direction === 'toml2json' ? TOML_SAMPLE : JSON_SAMPLE
    }

    function run() {
      try {
        if (direction === 'toml2json') {
          result = JSON.stringify(parseToml(input.value), null, 2)
        } else {
          result = toToml(JSON.parse(input.value))
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
        ),
        actions(
          copyButton(() => result, { label: 'Copy' }),
          button('Download', {
            icon: 'download',
            onClick: () => download(direction === 'toml2json' ? 'config.json' : 'config.toml', result),
          }),
        ),
        note('Datetimes have no JSON form, so they pass through as text and survive a round trip unchanged.'),
      ),
    )

    sample()
    run()
  },
}

export default tool
