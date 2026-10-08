import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { diffLines, diffStats, diffWords, type DiffPart } from './diff'

const tool: Tool = {
  slug: 'text-diff',
  name: 'Text Diff Viewer',
  description: 'Compare two blocks of text line by line or word by word.',
  category: 'Text',
  keywords: ['diff', 'compare', 'changes', 'patch', 'side by side'],
  render(root) {
    const before = el('textarea', {
      class: 'ts-textarea',
      rows: 8,
      placeholder: 'Original text…',
      'aria-label': 'Original text',
    }) as HTMLTextAreaElement
    const after = el('textarea', {
      class: 'ts-textarea',
      rows: 8,
      placeholder: 'Changed text…',
      'aria-label': 'Changed text',
    }) as HTMLTextAreaElement

    let mode: 'line' | 'word' = 'line'

    const modeSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    modeSelect.append(el('option', { value: 'line' }, 'Lines'), el('option', { value: 'word' }, 'Words'))
    modeSelect.value = mode
    modeSelect.addEventListener('change', () => {
      mode = modeSelect.value as 'line' | 'word'
      render()
    })

    const summary = el('div', { class: 'ts-row ts-wrap' })
    const output = el('div', { class: 'ts-diff' })

    function span(part: DiffPart) {
      const cls = part.type === 'add' ? 'ts-diff-add' : part.type === 'remove' ? 'ts-diff-remove' : 'ts-diff-equal'
      const marker = part.type === 'add' ? '+ ' : part.type === 'remove' ? '− ' : '  '
      const lines = part.value.split('\n')
      return el(
        'div',
        { class: `ts-diff-part ${cls}` },
        el('span', { class: 'ts-diff-marker' }, marker),
        el('span', { class: 'ts-diff-text' }, lines.join('\n')),
      )
    }

    function render() {
      const parts = mode === 'line' ? diffLines(before.value, after.value) : diffWords(before.value, after.value)
      const stats = diffStats(parts)
      summary.replaceChildren(
        el('span', { class: 'ts-badge ts-pass' }, `+${stats.added}`),
        el('span', { class: 'ts-badge ts-fail' }, `−${stats.removed}`),
        el('span', { class: 'ts-muted' }, `${stats.unchanged} unchanged`),
      )
      output.replaceChildren(...parts.map(span))
    }

    before.addEventListener('input', render)
    after.addEventListener('input', render)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-diff-columns' },
          el('div', { class: 'ts-field' }, el('label', {}, 'Before'), before),
          el('div', { class: 'ts-field' }, el('label', {}, 'After'), after),
        ),
        el(
          'div',
          { class: 'ts-row ts-between' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Mode'), modeSelect),
          summary,
        ),
        output,
        el('p', { class: 'ts-note' }, 'Diffing happens in your browser; nothing is uploaded.'),
      ),
    )

    render()
  },
}

export default tool
