import { el } from '../../core/dom'
import { copyChip, download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { clean, inspect, type CleanOptions } from './whitespace'

const SAMPLE = `  function greet(name) {   \n\t\treturn "hi " + name;   \n  }  \n\n\n\n  greet("world");  `

interface Toggle {
  key: keyof CleanOptions
  label: string
  hint: string
}

const TOGGLES: Toggle[] = [
  { key: 'normalizeNewlines', label: 'Normalise line endings', hint: 'CRLF and CR become LF' },
  { key: 'tabsToSpaces', label: 'Tabs to spaces', hint: 'Expand tabs to the width below' },
  { key: 'collapseSpaces', label: 'Collapse spaces', hint: 'Runs of spaces become one' },
  { key: 'trimLines', label: 'Trim each line', hint: 'Remove leading and trailing space' },
  { key: 'removeEmptyLines', label: 'Remove empty lines', hint: 'Delete every blank line' },
  { key: 'joinLines', label: 'Join lines', hint: 'Merge everything into one paragraph' },
  { key: 'trimDocument', label: 'Trim document', hint: 'Remove space at the very start and end' },
]

const tool: Tool = {
  slug: 'whitespace-cleaner',
  name: 'Whitespace Cleaner',
  description: 'Trim, collapse and normalise whitespace, and see exactly which rules changed what.',
  category: 'Text',
  keywords: ['whitespace', 'trim', 'clean', 'tabs', 'spaces', 'crlf', 'blank lines', 'format'],
  render(root) {
    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 12, spellcheck: false }) as HTMLTextAreaElement
    input.value = SAMPLE
    const output = el('textarea', { class: 'ts-textarea ts-mono', rows: 12, spellcheck: false, readonly: true }) as HTMLTextAreaElement
    const issues = el('div', { class: 'ts-ws-issues' })
    const summary = el('p', { class: 'ts-muted' })

    const checks = TOGGLES.map((toggle) => {
      const box = el('input', { type: 'checkbox', checked: true }) as HTMLInputElement
      return { toggle, box }
    })
    const maxBlank = el('input', { class: 'ts-input ts-mono', type: 'number', min: '0', value: '1' }) as HTMLInputElement
    const tabWidth = el('input', { class: 'ts-input ts-mono', type: 'number', min: '1', max: '16', value: '4' }) as HTMLInputElement
    let cleaned = ''

    function run() {
      const options: CleanOptions = { maxBlankLines: Number(maxBlank.value) || 0, tabWidth: Number(tabWidth.value) || 4 }
      for (const { toggle, box } of checks) options[toggle.key] = box.checked as never
      const result = clean(input.value, options)
      cleaned = result.text
      output.value = result.text
      summary.textContent = `${result.linesBefore} → ${result.linesAfter} lines · ${result.charactersRemoved} characters removed`

      const found = inspect(input.value)
      issues.replaceChildren()
      const labels: [keyof typeof found, string][] = [
        ['trailingWhitespace', 'lines with trailing space'],
        ['leadingWhitespace', 'lines with leading space'],
        ['tabs', 'tab characters'],
        ['crlf', 'CRLF endings'],
        ['multipleSpaces', 'runs of multiple spaces'],
        ['blankLines', 'blank lines'],
      ]
      for (const [key, label] of labels) {
        const count = found[key]
        issues.append(el('span', { class: count > 0 ? 'ts-ws-issue ts-ws-issue-on' : 'ts-ws-issue' }, `${count} ${label}`))
      }
    }

    for (const { box } of checks) box.addEventListener('change', run)
    maxBlank.addEventListener('input', run)
    tabWidth.addEventListener('input', run)
    input.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Input'), input),
        el('div', { class: 'ts-ws-issues' }, el('span', { class: 'ts-muted' }, 'Detected:'), issues),
        el(
          'div',
          { class: 'ts-checkbox-grid' },
          ...checks.map(({ toggle, box }) =>
            el('label', { class: 'ts-check' }, box, el('span', {}, toggle.label, el('small', { class: 'ts-ws-hint' }, toggle.hint))),
          ),
        ),
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Max blank lines'), maxBlank),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Tab width'), tabWidth),
        ),
        el('div', { class: 'ts-row ts-between' }, summary, el('div', { class: 'ts-tool-actions' }, copyChip(() => cleaned, 'Copy'), el('button', { class: 'ts-button', type: 'button', onclick: () => download('cleaned.txt', cleaned) }, 'Download'))),
        el('div', { class: 'ts-field' }, el('label', {}, 'Cleaned output'), output),
        el('p', { class: 'ts-note' }, 'Rules run in a fixed order so the same input always gives the same output. Nothing is uploaded.'),
      ),
    )

    run()
  },
}

export default tool
