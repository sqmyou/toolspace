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
  textarea,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { convert, EnvError, parseInput, type EnvFormat } from './env'

const FORMATS: { value: EnvFormat; label: string }[] = [
  { value: 'env', label: '.env' },
  { value: 'json', label: 'JSON' },
  { value: 'shell', label: 'Shell' },
  { value: 'compose', label: 'Compose' },
  { value: 'k8s', label: 'Kubernetes' },
]

const tool: Tool = {
  slug: 'env-converter',
  name: '.env Converter',
  description: 'Convert .env files to JSON, shell exports, docker-compose or Kubernetes env.',
  category: 'Data',
  keywords: ['env', 'dotenv', 'environment', 'json', 'shell', 'docker', 'compose', 'kubernetes', 'secrets'],
  render(root) {
    let format: EnvFormat = 'env'
    const input = textarea({ rows: 10, placeholder: 'KEY=value\n# or paste a JSON object…', onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    let rendered = ''
    const output = outputBlock('', { label: 'Output', copy: () => rendered })

    const formatControl = segmented({
      label: 'Output format',
      value: format,
      items: FORMATS.map((item) => ({ value: item.value, label: item.label })),
      onChange: (value) => {
        format = value as EnvFormat
        run()
      },
    })

    function run() {
      const text = input.value
      if (!text.trim()) {
        rendered = ''
        output.body.replaceChildren('')
        output.setMeta('')
        error.hidden = true
        return
      }
      try {
        const entries = parseInput(text)
        rendered = convert(entries, format)
        output.body.replaceChildren(rendered)
        output.setMeta(`${entries.length} variable${entries.length === 1 ? '' : 's'}`)
        error.hidden = true
      } catch (err) {
        rendered = ''
        output.body.replaceChildren('')
        output.setMeta('')
        error.textContent = err instanceof EnvError || err instanceof SyntaxError ? err.message : 'Could not convert that input.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'Input', icon: 'text' }, formatControl, field(input, { label: '.env or JSON' }), error),
        output,
        actions(
          copyButton(() => rendered, { label: 'Copy' }),
          button('Download', { icon: 'download', onClick: () => download('output.txt', rendered, 'text/plain') }),
        ),
        note('Values often hold secrets — they are converted entirely in your browser and never sent anywhere.'),
      ),
    )

    run()
  },
}

export default tool
