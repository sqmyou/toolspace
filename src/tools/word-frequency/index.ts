import {
  actions,
  badge,
  button,
  checkbox,
  copyButton,
  field,
  note,
  panel,
  select,
  table,
  textarea,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
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
    const input = textarea({
      rows: 10,
      mono: false,
      value: SAMPLE,
      onInput: () => run(),
    })

    const ngramSelect = select({
      options: [
        { value: '1', label: 'Single words' },
        { value: '2', label: 'Two-word phrases' },
        { value: '3', label: 'Three-word phrases' },
      ],
      value: '1',
      onChange: () => run(),
    })

    const minLength = textField({ type: 'number', value: '1', mono: true, onInput: () => run() })
    const top = textField({ type: 'number', value: '25', mono: true, onInput: () => run() })
    let caseSensitive = false
    let ignoreStopWords = false

    const summary = el('div', { class: 'ts-wf-summary' })
    const results = el('div', { class: 'ts-wf-results' })
    let exportText = ''

    function run() {
      const report = frequency(input.value, {
        ngramSize: Number(ngramSelect.value),
        minLength: Number(minLength.value) || 1,
        top: Number(top.value) || 0,
        caseSensitive,
        ignoreStopWords,
      })

      summary.replaceChildren(
        badge(`${report.totalWords} words`, 'accent'),
        badge(`${report.uniqueWords} unique`),
        badge(`${report.entries.length} shown`),
      )

      results.replaceChildren(
        table(
          [
            { key: 'term', label: 'Term', mono: true },
            { key: 'count', label: 'Count' },
            { key: 'share', label: 'Share' },
            { key: 'percent', label: '%' },
          ],
          report.entries.map((entry) => ({
            term: entry.term,
            count: String(entry.count),
            share: el(
              'div',
              { class: 'ts-wf-bar' },
              el('div', { class: 'ts-wf-bar-fill', style: `width:${entry.percent.toFixed(1)}%` }),
            ),
            percent: `${entry.percent.toFixed(1)}%`,
          })),
        ),
      )

      exportText = report.entries.map((entry) => `${entry.term}\t${entry.count}\t${entry.percent.toFixed(2)}%`).join('\n')
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Text', icon: 'text' },
          input,
          actions(
            button('Load sample', {
              icon: 'refresh',
              onClick: () => {
                input.value = SAMPLE
                run()
              },
            }),
            button('Clear', {
              icon: 'x',
              onClick: () => {
                input.value = ''
                run()
              },
            }),
          ),
        ),
        panel(
          { title: 'Counting', icon: 'sliders' },
          actions(
            field(ngramSelect, { label: 'Phrase length' }),
            field(minLength, { label: 'Min length', grow: true }),
            field(top, { label: 'Show top', grow: true }),
            checkbox({ label: 'Case sensitive', onChange: (checked) => { caseSensitive = checked; run() } }),
            checkbox({ label: 'Ignore stop words', onChange: (checked) => { ignoreStopWords = checked; run() } }),
          ),
        ),
        actions(summary, copyButton(() => exportText, { label: 'Copy TSV', size: 'sm' })),
        results,
        note('Words keep internal apostrophes and hyphens. Everything is counted in your browser.'),
      ),
    )

    run()
  },
}

export default tool
