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
import { parseYaml, toYaml } from './yaml'

const YAML_SAMPLE = `name: release
on:
  push:
    branches: [main]
  schedule:
    - cron: "0 6 * * 1"
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - name: Test
        run: npm test
`

const JSON_SAMPLE = JSON.stringify(
  {
    name: 'release',
    on: { push: { branches: ['main'] }, schedule: [{ cron: '0 6 * * 1' }] },
    jobs: { build: { 'runs-on': 'ubuntu-latest', steps: [{ uses: 'actions/checkout@v5' }, { name: 'Test', run: 'npm test' }] } },
  },
  null,
  2,
)

const tool: Tool = {
  slug: 'yaml-json',
  name: 'YAML ↔ JSON Converter',
  description: 'Convert between YAML and JSON, with specific errors for the YAML it cannot read.',
  category: 'Data',
  keywords: ['yaml', 'yml', 'json', 'convert', 'config', 'kubernetes', 'actions', 'docker-compose', 'ci'],
  render(root) {
    let direction: 'yaml2json' | 'json2yaml' = 'yaml2json'
    const input = textarea({ rows: 16, onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    let result = ''
    const output = outputBlock('', { label: 'Output', copy: () => result })

    const directionControl = segmented({
      label: 'Direction',
      value: direction,
      items: [
        { value: 'yaml2json', label: 'YAML → JSON' },
        { value: 'json2yaml', label: 'JSON → YAML' },
      ],
      onChange: (value) => {
        direction = value as 'yaml2json' | 'json2yaml'
        sample()
        run()
      },
    })

    function sample() {
      input.value = direction === 'yaml2json' ? YAML_SAMPLE : JSON_SAMPLE
    }

    function run() {
      try {
        if (direction === 'yaml2json') {
          result = JSON.stringify(parseYaml(input.value), null, 2)
        } else {
          result = toYaml(JSON.parse(input.value))
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
            onClick: () => download(direction === 'yaml2json' ? 'data.json' : 'data.yaml', result),
          }),
        ),
        note('Anchors, aliases, tags and multi-document files are refused with an error rather than parsed wrongly. YAML 1.2 core rules apply, so "on" and "yes" stay text.'),
      ),
    )

    sample()
    run()
  },
}

export default tool
