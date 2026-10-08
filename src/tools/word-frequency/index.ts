import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { frequency } from './wordfreq'

const SAMPLE = `The quick brown fox jumps over the lazy dog.
The dog barks, and the fox runs away.
A quick fox is a lucky fox.`

const tool: Tool = {
  slug: 'word-frequency',
  name: 'Word Frequency Counter',
  description: 'Count word and n-gram frequency, with stop-word filtering and a share of total.',
  category: 'Text',
  keywords: ['word', 'frequency', 'count', 'ngram', 'bigram', 'occurrences', 'analysis', 'keywords'],
  render(root) {
    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 10, spellcheck: false }) as HTMLTextAreaElement
    input.value = SAMPLE
    const ngramSelect = el('select', { class: 'ts-select' }, el('option', { value: '1' }, 'Single words'), el('option', { value: '2' }, 'Two-word phrases'), el('option', { value: '3' }, 'Three-word phrases')) as HTMLSelectElement
    const minLength = el('input', { class: 'ts-input ts-mono', type: 'number', min: '1', value: '1' }) as HTMLInputElement
    const top = el('input', { class: 'ts-input ts-mono', type: 'number', min: '0', value: '25' }) as HTMLInputElement
    const caseSensitive = el('input', { type: 'checkbox' }) as HTMLInputElement
    const stopWords = el('input', { type: 'checkbox' }) as HTMLInputElement
    const summary = el('p', { class: 'ts-muted' })
    const table = el('tbody')
    let exportText = ''

    function run() {
      const report = frequency(input.value, {
        ngramSize: Number(ngramSelect.value),
        minLength: Number(minLength.value) || 1,
        top: Number(top.value) || 0,
        caseSensitive: caseSensitive.checked,
        ignoreStopWords: stopWords.checked,
      })
      summary.textContent = `${report.totalWords} words · ${report.uniqueWords} unique`
      table.replaceChildren()
      for (const entry of report.entries) {
        table.append(
          el(
            'tr',
            {},
            el('td', { class: 'ts-wf-term' }, entry.term),
            el('td', { class: 'ts-wf-num' }, String(entry.count)),
            el(
              'td',
              { class: 'ts-wf-bar-cell' },
              el('div', { class: 'ts-wf-bar' }, el('div', { class: 'ts-wf-bar-fill', style: `width:${entry.percent.toFixed(1)}%` })),
            ),
            el('td', { class: 'ts-wf-num' }, `${entry.percent.toFixed(1)}%`),
          ),
        )
      }
      exportText = report.entries.map((entry) => `${entry.term}\t${entry.count}\t${entry.percent.toFixed(2)}%`).join('\n')
    }

    for (const control of [ngramSelect, minLength, top, caseSensitive, stopWords]) control.addEventListener('change', run)
    for (const control of [minLength, top]) control.addEventListener('input', run)
    input.addEventListener('input', run)

    const field = (label: string, control: HTMLElement) => el('div', { class: 'ts-inline-field' }, el('label', {}, label), control)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Text'), input),
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          field('Phrase length', ngramSelect),
          field('Min length', minLength),
          field('Show top', top),
          el('label', { class: 'ts-inline-field' }, caseSensitive, 'Case sensitive'),
          el('label', { class: 'ts-inline-field' }, stopWords, 'Ignore stop words'),
          copyChip(() => exportText, 'Copy TSV'),
        ),
        summary,
        el('div', { class: 'ts-table-wrap' }, el('table', { class: 'ts-table' }, el('thead', {}, el('tr', {}, el('th', {}, 'Term'), el('th', {}, 'Count'), el('th', {}, 'Share'), el('th', {}, '%'))), table)),
        el('p', { class: 'ts-note' }, 'Words keep internal apostrophes and hyphens. Everything is counted in your browser.'),
      ),
    )

    run()
  },
}

export default tool
