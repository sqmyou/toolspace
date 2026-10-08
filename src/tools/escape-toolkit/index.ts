import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { escape, FLAVORS, unescape, type Flavor } from './escape'

const tool: Tool = {
  slug: 'escape-toolkit',
  name: 'Escape / Unescape',
  description: 'Escape or unescape text for JSON, JS, HTML, XML, URL, SQL, shell, regex and CSV.',
  category: 'Text',
  keywords: ['escape', 'unescape', 'encode', 'decode', 'json', 'html', 'url', 'sql', 'shell', 'regex', 'csv'],
  render(root) {
    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 6, spellcheck: false, placeholder: 'Text to escape…' }) as HTMLTextAreaElement
    const output = el('pre', { class: 'ts-json-block' })
    const error = el('p', { class: 'ts-error', hidden: true })

    const flavorSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const flavor of FLAVORS) flavorSelect.append(el('option', { value: flavor.value }, flavor.label))

    let direction: 'escape' | 'unescape' = 'escape'
    let rendered = ''

    const escapeBtn = el('button', { class: 'ts-button ts-active', type: 'button' }, 'Escape')
    const unescapeBtn = el('button', { class: 'ts-button', type: 'button' }, 'Unescape')

    function setDirection(next: 'escape' | 'unescape') {
      direction = next
      escapeBtn.classList.toggle('ts-active', next === 'escape')
      unescapeBtn.classList.toggle('ts-active', next === 'unescape')
      run()
    }
    escapeBtn.addEventListener('click', () => setDirection('escape'))
    unescapeBtn.addEventListener('click', () => setDirection('unescape'))

    function run() {
      const text = input.value
      if (!text) {
        rendered = ''
        output.textContent = ''
        error.hidden = true
        return
      }
      try {
        rendered = direction === 'escape' ? escape(text, flavorSelect.value as Flavor) : unescape(text, flavorSelect.value as Flavor)
        output.textContent = rendered
        error.hidden = true
      } catch {
        rendered = ''
        output.textContent = ''
        error.textContent = 'That text could not be unescaped for this flavour.'
        error.hidden = false
      }
    }

    input.addEventListener('input', run)
    flavorSelect.addEventListener('change', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-row ts-wrap ts-between' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Flavour'), flavorSelect),
          el('div', { class: 'ts-tool-actions' }, escapeBtn, unescapeBtn),
        ),
        el('div', { class: 'ts-field' }, el('label', {}, 'Input'), input),
        error,
        el(
          'div',
          { class: 'ts-row ts-between' },
          el('h3', { class: 'ts-subhead' }, 'Result'),
          copyChip(() => rendered, 'Copy'),
        ),
        output,
        el('p', { class: 'ts-note' }, 'Everything is escaped locally. The CSV flavour also blocks spreadsheet formula injection.'),
      ),
    )

    run()
  },
}

export default tool
