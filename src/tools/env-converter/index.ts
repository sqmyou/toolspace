import { el } from '../../core/dom'
import { copyChip, download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { convert, EnvError, parseInput, type EnvFormat } from './env'

const FORMATS: { value: EnvFormat; label: string }[] = [
  { value: 'env', label: '.env' },
  { value: 'json', label: 'JSON' },
  { value: 'shell', label: 'Shell exports' },
  { value: 'compose', label: 'Docker Compose' },
  { value: 'k8s', label: 'Kubernetes env' },
]

const tool: Tool = {
  slug: 'env-converter',
  name: '.env Converter',
  description: 'Convert .env files to JSON, shell exports, docker-compose or Kubernetes env.',
  category: 'Data',
  keywords: ['env', 'dotenv', 'environment', 'json', 'shell', 'docker', 'compose', 'kubernetes', 'secrets'],
  render(root) {
    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 10, spellcheck: false, placeholder: 'KEY=value\n# or paste a JSON object…' }) as HTMLTextAreaElement
    const output = el('pre', { class: 'ts-json-block' })
    const error = el('p', { class: 'ts-error', hidden: true })
    const count = el('p', { class: 'ts-muted' })

    const formatSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const format of FORMATS) formatSelect.append(el('option', { value: format.value }, format.label))

    let rendered = ''

    function run() {
      const text = input.value
      if (!text.trim()) {
        rendered = ''
        output.textContent = ''
        error.hidden = true
        count.textContent = ''
        return
      }
      try {
        const entries = parseInput(text)
        rendered = convert(entries, formatSelect.value as EnvFormat)
        output.textContent = rendered
        error.hidden = true
        count.textContent = `${entries.length} variable${entries.length === 1 ? '' : 's'}`
      } catch (err) {
        rendered = ''
        output.textContent = ''
        error.textContent = err instanceof EnvError || err instanceof SyntaxError ? err.message : 'Could not convert that input.'
        error.hidden = false
        count.textContent = ''
      }
    }

    input.addEventListener('input', run)
    formatSelect.addEventListener('change', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-inline-field' }, el('label', {}, 'Output format'), formatSelect),
        el('div', { class: 'ts-field' }, el('label', {}, 'Input (.env or JSON)'), input),
        error,
        el(
          'div',
          { class: 'ts-row ts-between' },
          count,
          el(
            'div',
            { class: 'ts-tool-actions' },
            copyChip(() => rendered, 'Copy'),
            el('button', { class: 'ts-button', type: 'button', onclick: () => download('output.txt', rendered, 'text/plain') }, 'Download'),
          ),
        ),
        output,
        el('p', { class: 'ts-note' }, 'Values often hold secrets — they are converted entirely in your browser and never sent anywhere.'),
      ),
    )

    run()
  },
}

export default tool
