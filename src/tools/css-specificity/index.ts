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
    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 6, spellcheck: false, placeholder: '.card .title, #main a:hover, ul > li' }) as HTMLTextAreaElement
    const output = el('div', { class: 'ts-spec-list' })
    const summary = el('p', { class: 'ts-muted' })

    function run() {
      output.replaceChildren()
      const report = analyse(input.value)
      if (report.scores.length === 0) {
        summary.textContent = ''
        return
      }
      summary.textContent = `${report.scores.length} selector${report.scores.length === 1 ? '' : 's'} · highest ${formatSpecificity(report.max)}`
      const isMax = (s: Specificity) => compareSpecificity(s, report.max) === 0 && report.scores.length > 1
      for (const score of report.sorted) {
        const row = el('div', { class: 'ts-spec-row' })
        if (isMax(score.specificity)) row.classList.add('ts-spec-top')
        row.append(
          el('code', { class: 'ts-spec-selector' }, score.selector),
          el('span', { class: 'ts-spec-score' }, formatSpecificity(score.specificity)),
          ...(score.important ? [el('span', { class: 'ts-spec-important' }, '!important')] : []),
        )
        output.append(row)
      }
    }

    input.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Selectors (comma-separated)'), input),
        summary,
        output,
        el('p', { class: 'ts-note' }, 'Scores are shown as (ids, classes, elements). Attribute and pseudo-class selectors count as classes; :where() counts as nothing.'),
      ),
    )

    run()
  },
}

export default tool
