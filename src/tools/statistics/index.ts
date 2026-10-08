import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { parseNumbers, summarise, zScores } from './stats'

function figure(value: number | null, decimals = 4): string {
  if (value === null) return '—'
  if (!Number.isFinite(value)) return '—'
  return Number(value.toFixed(decimals)).toString()
}

const tool: Tool = {
  slug: 'statistics',
  name: 'Statistics Calculator',
  description: 'Mean, median, spread, quartiles, outliers and shape for a list of numbers.',
  category: 'Numbers',
  keywords: ['statistics', 'mean', 'median', 'mode', 'variance', 'standard deviation', 'quartile', 'outlier', 'percentile'],
  render(root) {
    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 6, spellcheck: false }, '2, 4, 4, 4, 5, 5, 7, 9') as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const list = el('div', { class: 'ts-copy-list' })
    const zList = el('div', { class: 'ts-copy-list' })

    function run() {
      list.replaceChildren()
      zList.replaceChildren()
      try {
        const values = parseNumbers(input.value)
        const summary = summarise(values)
        const rows: [string, string][] = [
          ['Count', String(summary.count)],
          ['Sum', figure(summary.sum, 6)],
          ['Minimum', figure(summary.min, 6)],
          ['Maximum', figure(summary.max, 6)],
          ['Range', figure(summary.range, 6)],
          ['Mean', figure(summary.mean)],
          ['Median', figure(summary.median)],
          ['Mode', summary.mode.length ? summary.mode.join(', ') : 'none'],
          ['Variance (sample)', figure(summary.varianceSample)],
          ['Variance (population)', figure(summary.variancePopulation)],
          ['Std deviation (sample)', figure(summary.standardDeviationSample)],
          ['Std deviation (population)', figure(summary.standardDeviationPopulation)],
          ['Q1', figure(summary.quartiles.q1)],
          ['Q3', figure(summary.quartiles.q3)],
          ['Interquartile range', figure(summary.quartiles.iqr)],
          ['Skewness', figure(summary.skewness)],
          ['Kurtosis (excess)', figure(summary.kurtosis)],
          ['Geometric mean', figure(summary.geometricMean)],
          ['Harmonic mean', figure(summary.harmonicMean)],
        ]
        for (const [label, value] of rows) list.append(el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted ts-stats-name' }, label), el('code', { class: 'ts-stats-value' }, value), copyChip(value, 'Copy')))

        for (const [index, score] of zScores(values).entries()) {
          zList.append(el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted ts-stats-name' }, `#${index + 1} = ${values[index]}`), el('code', { class: 'ts-stats-value' }, figure(score))))
        }
        error.hidden = true
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not read those numbers.'
        error.hidden = false
      }
    }

    input.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Numbers (any separator)'), input),
        error,
        el('div', { class: 'ts-stats-grid' }, list, el('div', {}, el('h3', { class: 'ts-subhead' }, 'Z-scores'), zList)),
        el('p', { class: 'ts-note' }, 'Quartiles interpolate between ranks, matching a spreadsheet. Sample figures need two values, skewness three and kurtosis four; otherwise they show a dash.'),
      ),
    )

    run()
  },
}

export default tool
