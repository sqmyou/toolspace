import {
  copyRow,
  grid,
  kvList,
  note,
  panel,
  stats as statStrip,
  textarea,
  toolLayout,
  field,
  stat,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { parseNumbers, summarise, zScores } from './stats'

function figure(value: number | null, decimals = 4): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return Number(value.toFixed(decimals)).toString()
}

const tool: Tool = {
  slug: 'statistics',
  name: 'Statistics Calculator',
  description: 'Mean, median, spread, quartiles, outliers and shape for a list of numbers.',
  category: 'Numbers',
  keywords: ['statistics', 'mean', 'median', 'mode', 'variance', 'standard deviation', 'quartile', 'outlier', 'percentile'],
  render(root) {
    const input = textarea({ rows: 6, value: '2, 4, 4, 4, 5, 5, 7, 9', onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    const headline = statStrip()
    const rows = kvList()
    const zRows = kvList()

    function run() {
      rows.replaceChildren()
      zRows.replaceChildren()
      try {
        const values = parseNumbers(input.value)
        const summary = summarise(values)
        headline.replaceChildren(
          stat({ label: 'Count', value: String(summary.count) }),
          stat({ label: 'Mean', value: figure(summary.mean) }),
          stat({ label: 'Median', value: figure(summary.median) }),
          stat({ label: 'Std dev (sample)', value: figure(summary.standardDeviationSample) }),
        )
        const entries: [string, string][] = [
          ['Sum', figure(summary.sum, 6)],
          ['Minimum', figure(summary.min, 6)],
          ['Maximum', figure(summary.max, 6)],
          ['Range', figure(summary.range, 6)],
          ['Mode', summary.mode.length ? summary.mode.join(', ') : 'none'],
          ['Variance (sample)', figure(summary.varianceSample)],
          ['Variance (population)', figure(summary.variancePopulation)],
          ['Std deviation (population)', figure(summary.standardDeviationPopulation)],
          ['Q1', figure(summary.quartiles.q1)],
          ['Q3', figure(summary.quartiles.q3)],
          ['Interquartile range', figure(summary.quartiles.iqr)],
          ['Skewness', figure(summary.skewness)],
          ['Kurtosis (excess)', figure(summary.kurtosis)],
          ['Geometric mean', figure(summary.geometricMean)],
          ['Harmonic mean', figure(summary.harmonicMean)],
        ]
        rows.replaceChildren(...entries.map(([label, value]) => copyRow(label, value)))

        zRows.replaceChildren(
          ...zScores(values).map((score, index) => copyRow(`#${index + 1} = ${values[index]}`, figure(score))),
        )
        error.hidden = true
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not read those numbers.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'Numbers', icon: 'hash' }, field(input, { label: 'Numbers (any separator)' }), error),
        headline,
        grid(320, panel({ title: 'Summary', icon: 'layers' }, rows), panel({ title: 'Z-scores', icon: 'chart' }, zRows)),
        note('Quartiles interpolate between ranks, matching a spreadsheet. Sample figures need two values, skewness three and kurtosis four; otherwise they show a dash.'),
      ),
    )

    run()
  },
}

export default tool
