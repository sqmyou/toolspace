import {
  badge,
  field,
  grid,
  note,
  panel,
  segmented,
  stat,
  stats,
  table,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { diffLines, diffStats, diffWords, type DiffPart } from './diff'
import { closestPairs, levenshtein, similarityPercent } from './similarity'

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
    let mode: 'line' | 'word' | 'text' = 'line'

    const before = textarea({ rows: 10, mono: true, value: BEFORE, onInput: () => render() })
    const after = textarea({ rows: 10, mono: true, value: AFTER, onInput: () => render() })

    const modeControl = segmented({
      label: 'Compare',
      items: [
        { value: 'line', label: 'Lines' },
        { value: 'word', label: 'Words' },
        { value: 'text', label: 'Similarity' },
      ],
      value: mode,
      onChange: (value) => {
        mode = value as 'line' | 'word' | 'text'
        render()
      },
    })

    const summary = el('div', { class: 'ts-diff-summary' })
    const output = el('div', { class: 'ts-diff' })
    const similarityStats = stats()
    const pairTable = el('div')
    const changesPanel = panel({ title: 'Changes', icon: 'diff' }, summary, output)
    const similarityPanel = panel({ title: 'Similarity', icon: 'chart' }, similarityStats, pairTable)

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

    function renderDiff() {
      const parts = mode === 'line' ? diffLines(before.value, after.value) : diffWords(before.value, after.value)
      const stats = diffStats(parts)
      summary.replaceChildren(
        badge(`+${stats.added}`, 'ok'),
        badge(`−${stats.removed}`, 'danger'),
        badge(`${stats.unchanged} unchanged`),
      )
      output.replaceChildren(...parts.map(span))
    }

    function renderSimilarity() {
      const percent = similarityPercent(before.value, after.value)
      similarityStats.replaceChildren(
        stat({ label: 'Similarity', value: `${percent}%`, hint: 'whole documents' }),
        stat({ label: 'Edit distance', value: String(levenshtein(before.value, after.value)), hint: 'characters changed' }),
        stat({ label: 'Length', value: `${before.value.length} → ${after.value.length}` }),
      )
      const rows = closestPairs(before.value, after.value)
      pairTable.replaceChildren(
        rows.length
          ? table(
              [
                { key: 'percent', label: 'Match' },
                { key: 'distance', label: 'Distance' },
                { key: 'a', label: 'Before', mono: true },
                { key: 'b', label: 'After', mono: true },
              ],
              rows.map((row) => ({
                percent: `${row.percent}%`,
                distance: String(row.distance),
                a: row.a,
                b: row.b,
              })),
            )
          : note('No distinct line pairs to compare.'),
      )
    }

    function render() {
      const similarity = mode === 'text'
      changesPanel.hidden = similarity
      similarityPanel.hidden = !similarity
      if (similarity) renderSimilarity()
      else renderDiff()
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
        changesPanel,
        similarityPanel,
        note('Similarity uses Levenshtein edit distance: 100% means identical, 0% means nothing in common.'),
      ),
    )

    render()
  },
}

export default tool
