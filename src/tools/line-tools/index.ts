import { el } from '../../core/dom'
import { copyChip, download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { DEFAULT_OPTIONS, lineStats, processLines, type LineOptions } from './lines'

function checkbox(label: string, get: (options: LineOptions) => boolean, set: (options: LineOptions, value: boolean) => void, options: LineOptions, onChange: () => void): HTMLElement {
  const input = el('input', { type: 'checkbox' }) as HTMLInputElement
  input.checked = get(options)
  input.addEventListener('change', () => {
    set(options, input.checked)
    onChange()
  })
  return el('label', { class: 'ts-inline-field' }, input, label)
}

const tool: Tool = {
  slug: 'line-tools',
  name: 'Line Sorter & Deduplicator',
  description: 'Sort, deduplicate, reverse, shuffle, trim and number lines of text.',
  category: 'Text',
  keywords: ['lines', 'sort', 'dedupe', 'unique', 'shuffle', 'reverse', 'trim', 'number', 'list'],
  render(root) {
    const options: LineOptions = { ...DEFAULT_OPTIONS }
    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 8, spellcheck: false, placeholder: 'One item per line…' }) as HTMLTextAreaElement
    const output = el('pre', { class: 'ts-json-block' })
    const stats = el('p', { class: 'ts-muted' })

    const sortSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const [value, label] of [['none', 'Keep order'], ['asc', 'A → Z'], ['desc', 'Z → A'], ['length', 'By length']] as const) {
      sortSelect.append(el('option', { value }, label))
    }
    sortSelect.addEventListener('change', () => {
      options.sort = sortSelect.value as LineOptions['sort']
      run()
    })

    const numberSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const [value, label] of [['none', 'No numbers'], ['plain', '1 2 3'], ['dot', '1. 2. 3.'], ['paren', '1) 2) 3)']] as const) {
      numberSelect.append(el('option', { value }, label))
    }
    numberSelect.addEventListener('change', () => {
      options.numbering = numberSelect.value as LineOptions['numbering']
      run()
    })

    let rendered = ''

    function run() {
      rendered = processLines(input.value, options)
      output.textContent = rendered
      const info = lineStats(rendered)
      stats.textContent = `${info.lines} lines · ${info.unique} unique · ${info.words} words · ${info.bytes} bytes`
    }

    input.addEventListener('input', run)

    const onToggle = () => run()

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Sort'), sortSelect),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Numbering'), numberSelect),
        ),
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          checkbox('Trim', (o) => o.trim, (o, v) => (o.trim = v), options, onToggle),
          checkbox('Drop empty', (o) => o.dropEmpty, (o, v) => (o.dropEmpty = v), options, onToggle),
          checkbox('Deduplicate', (o) => o.dedupe, (o, v) => (o.dedupe = v), options, onToggle),
          checkbox('Dedupe is case-sensitive', (o) => o.dedupeCaseSensitive, (o, v) => (o.dedupeCaseSensitive = v), options, onToggle),
          checkbox('Sort is case-sensitive', (o) => o.caseSensitive, (o, v) => (o.caseSensitive = v), options, onToggle),
          checkbox('Natural sort', (o) => o.natural, (o, v) => (o.natural = v), options, onToggle),
          checkbox('Reverse', (o) => o.reverse, (o, v) => (o.reverse = v), options, onToggle),
          checkbox('Shuffle', (o) => o.shuffle, (o, v) => (o.shuffle = v), options, onToggle),
        ),
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-field ts-grow' }, el('label', {}, 'Input'), input),
        ),
        el(
          'div',
          { class: 'ts-row ts-between' },
          stats,
          el(
            'div',
            { class: 'ts-tool-actions' },
            copyChip(() => rendered, 'Copy'),
            el('button', { class: 'ts-button', type: 'button', onclick: () => download('lines.txt', rendered, 'text/plain') }, 'Download'),
          ),
        ),
        output,
        el('p', { class: 'ts-note' }, 'All processing happens in your browser.'),
      ),
    )

    run()
  },
}

export default tool
