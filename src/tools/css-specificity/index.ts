import {
  badge,
  field,
  note,
  panel,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { analyse, compareSpecificity, formatSpecificity, type Specificity } from './specificity'

const tool: Tool = {
  slug: 'css-specificity',
  name: 'CSS Specificity Calculator',
  description: 'Score and rank CSS selectors, and see how their specificity compares.',
  category: 'Design',
  keywords: ['css', 'specificity', 'selector', 'cascade', 'important', 'ranking'],
  render(root) {
    const input = textarea({ rows: 6, placeholder: '.card .title, #main a:hover, ul > li', onInput: () => run() })
    const summary = el('div', { class: 'ts-k-chips' })
    const output = el('div', { class: 'ts-spec-list' })

    function run() {
      output.replaceChildren()
      summary.replaceChildren()
      const report = analyse(input.value)
      if (report.scores.length === 0) return
      summary.append(
        badge(`${report.scores.length} selector${report.scores.length === 1 ? '' : 's'}`),
        badge(`highest ${formatSpecificity(report.max)}`, 'accent'),
      )
      const isMax = (score: Specificity) => compareSpecificity(score, report.max) === 0 && report.scores.length > 1
      output.replaceChildren(
        ...report.sorted.map((score) =>
          el(
            'div',
            { class: `ts-spec-row${isMax(score.specificity) ? ' ts-spec-top' : ''}` },
            el('code', { class: 'ts-spec-selector' }, score.selector),
            el('span', { class: 'ts-spec-score' }, formatSpecificity(score.specificity)),
            score.important ? badge('!important', 'danger') : null,
          ),
        ),
      )
    }

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'Selectors', icon: 'code' }, field(input, { label: 'Selectors (comma-separated)' }), summary),
        panel({ title: 'Ranking', icon: 'chart' }, output),
        note('Scores are shown as (ids, classes, elements). Attribute and pseudo-class selectors count as classes; :where() counts as nothing.'),
      ),
    )

    run()
  },
}

export default tool
