import {
  actions,
  checkbox,
  copyButton,
  field,
  grid,
  note,
  panel,
  stat,
  stats,
  table,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { compare, percent, type SimilarityResult } from './similarity'

const ROWS: Array<{ key: keyof SimilarityResult; label: string; description: string }> = [
  { key: 'levenshtein', label: 'Levenshtein', description: 'Fewest insert, delete or substitute edits.' },
  { key: 'damerau', label: 'Damerau–Levenshtein', description: 'As above, but an adjacent swap counts as one edit.' },
  { key: 'jaro', label: 'Jaro', description: 'Rewards characters that appear in a matching window.' },
  { key: 'jaroWinkler', label: 'Jaro–Winkler', description: 'Jaro with a bonus for a shared prefix.' },
  { key: 'dice', label: 'Dice (bigrams)', description: 'Overlap of two-character chunks; order-insensitive.' },
]

const tool: Tool = {
  slug: 'string-similarity',
  name: 'String Similarity',
  description: 'Compare two strings with edit distance, Jaro–Winkler and Dice measures.',
  category: 'Text',
  keywords: ['levenshtein', 'similarity', 'distance', 'jaro', 'winkler', 'dice', 'diff', 'fuzzy', 'typo', 'compare'],
  render(root) {
    const left = textField({ value: 'kitten', placeholder: 'First string…', onInput: () => run() })
    const right = textField({ value: 'sitting', placeholder: 'Second string…', onInput: () => run() })
    let ignoreCaseValue = false
    let ignoreSpacesValue = true
    const ignoreCase = checkbox({
      label: 'Ignore case',
      checked: false,
      onChange: (checked) => {
        ignoreCaseValue = checked
        run()
      },
    })
    const ignoreSpaces = checkbox({
      label: 'Ignore leading/trailing spaces',
      checked: true,
      onChange: (checked) => {
        ignoreSpacesValue = checked
        run()
      },
    })
    const scores = stats()
    const error = note('', 'danger')
    error.hidden = true
    const tableHost = el('div')

    function renderTable(result: SimilarityResult): void {
      const rows = ROWS.map((row) => ({
        measure: row.label,
        value:
          row.key === 'levenshtein' || row.key === 'damerau'
            ? String(result[row.key] as number)
            : `${percent(result[row.key] as number)}%`,
        note: row.description,
      }))
      tableHost.replaceChildren(
        table(
          [
            { key: 'measure', label: 'Measure' },
            { key: 'value', label: 'Value', mono: true },
            { key: 'note', label: 'Meaning' },
          ],
          rows,
        ),
      )
    }

    function normalise(text: string): string {
      let value = text
      if (ignoreSpacesValue) value = value.trim()
      if (ignoreCaseValue) value = value.toLowerCase()
      return value
    }

    function run() {
      const a = normalise(left.value)
      const b = normalise(right.value)
      try {
        const result = compare(a, b)
        scores.replaceChildren(
          stat({ label: 'Levenshtein', value: String(result.levenshtein) }),
          stat({ label: 'Damerau', value: String(result.damerau) }),
          stat({ label: 'Jaro–Winkler', value: `${percent(result.jaroWinkler)}%` }),
          stat({ label: 'Dice', value: `${percent(result.dice)}%` }),
          stat({ label: 'Length Δ', value: String(Math.abs(a.length - b.length)) }),
        )
        renderTable(result)
        error.hidden = true
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not compare those strings.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Inputs', icon: 'text' },
          grid(240, field(left, { label: 'First string' }), field(right, { label: 'Second string' })),
          actions(ignoreCase, ignoreSpaces),
          error,
        ),
        panel({ title: 'Scores', icon: 'chart' }, scores, tableHost),
        actions(
          copyButton(
            () => {
              const a = normalise(left.value)
              const b = normalise(right.value)
              const result = compare(a, b)
              return JSON.stringify(result, null, 2)
            },
            { label: 'Copy scores as JSON' },
          ),
        ),
        note('Edit distances count how many changes are needed; the 0–100% measures say how alike the strings look. Use the percentage measures for ranking and the distances for a concrete number of edits.'),
      ),
    )

    run()
  },
}

export default tool
