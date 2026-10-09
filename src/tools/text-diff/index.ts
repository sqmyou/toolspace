import {
  badge,
  field,
  grid,
  panel,
  segmented,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { diffLines, diffStats, diffWords, type DiffPart } from './diff'

const BEFORE = `the quick brown fox
jumps over the lazy dog
the end`

const AFTER = `the quick red fox
jumps over the lazy dog
the very end`

const tool: Tool = {
  slug: 'text-diff',
  name: 'Text Diff Viewer',
  description: 'Compare two blocks of text line by line or word by word.',
  category: 'Text',
  keywords: ['diff', 'compare', 'changes', 'patch', 'side by side'],
  render(root) {
    let mode: 'line' | 'word' = 'line'

    const before = textarea({ rows: 10, mono: true, value: BEFORE, onInput: () => render() })
    const after = textarea({ rows: 10, mono: true, value: AFTER, onInput: () => render() })

    const modeControl = segmented({
      label: 'Compare',
      items: [
        { value: 'line', label: 'Lines' },
        { value: 'word', label: 'Words' },
      ],
      value: mode,
      onChange: (value) => {
        mode = value as 'line' | 'word'
        render()
      },
    })

    const summary = el('div', { class: 'ts-diff-summary' })
    const output = el('div', { class: 'ts-diff' })

    function span(part: DiffPart) {
      const cls = part.type === 'add' ? 'ts-diff-add' : part.type === 'remove' ? 'ts-diff-remove' : 'ts-diff-equal'
      const marker = part.type === 'add' ? '+ ' : part.type === 'remove' ? '− ' : '  '
      return el(
        'div',
        { class: `ts-diff-part ${cls}` },
        el('span', { class: 'ts-diff-marker' }, marker),
        el('span', { class: 'ts-diff-text' }, part.value),
      )
    }

    function render() {
      const parts = mode === 'line' ? diffLines(before.value, after.value) : diffWords(before.value, after.value)
      const stats = diffStats(parts)
      summary.replaceChildren(
        badge(`+${stats.added}`, 'ok'),
        badge(`−${stats.removed}`, 'danger'),
        badge(`${stats.unchanged} unchanged`),
      )
      output.replaceChildren(...parts.map(span))
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Compare', icon: 'sliders' },
          modeControl,
          grid(
            240,
            field(before, { label: 'Before' }),
            field(after, { label: 'After' }),
          ),
        ),
        panel({ title: 'Changes', icon: 'diff' }, summary, output),
              ),
    )

    render()
  },
}

export default tool
