import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { analyzeText, readingEaseLabel } from './stats'

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s'
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes ? `${minutes}m ${rest}s` : `${rest}s`
}

const tool: Tool = {
  slug: 'text-stats',
  name: 'Text Statistics & Readability',
  description: 'Count words, sentences and characters and score readability.',
  category: 'Text',
  keywords: ['word count', 'character count', 'readability', 'flesch', 'gunning fog', 'reading time'],
  render(root) {
    const input = el('textarea', {
      class: 'ts-textarea',
      rows: 8,
      placeholder: 'Paste text to analyse…',
      'aria-label': 'Text to analyse',
    }) as HTMLTextAreaElement

    const grid = el('div', { class: 'ts-stat-grid' })
    const readout = el('div', { class: 'ts-copy-list' })

    function stat(label: string, value: string) {
      return el('div', { class: 'ts-stat' }, el('span', { class: 'ts-muted' }, label), el('span', { class: 'ts-stat-value' }, value))
    }

    function update() {
      const stats = analyzeText(input.value)
      grid.replaceChildren(
        stat('Characters', String(stats.characters)),
        stat('Characters (no spaces)', String(stats.charactersNoSpaces)),
        stat('Words', String(stats.words)),
        stat('Unique words', String(stats.uniqueWords)),
        stat('Sentences', String(stats.sentences)),
        stat('Paragraphs', String(stats.paragraphs)),
        stat('Lines', String(stats.lines)),
        stat('Avg word length', stats.averageWordLength.toFixed(1)),
        stat('Longest word', stats.longestWord || '—'),
        stat('Reading time', formatDuration(stats.readingSeconds)),
        stat('Speaking time', formatDuration(stats.speakingSeconds)),
      )
      readout.replaceChildren(
        el(
          'div',
          { class: 'ts-copy-row' },
          el('span', { class: 'ts-muted' }, 'Flesch reading ease'),
          el('span', { class: 'ts-value' }, `${stats.fleschReadingEase.toFixed(1)} · ${readingEaseLabel(stats.fleschReadingEase)}`),
        ),
        el(
          'div',
          { class: 'ts-copy-row' },
          el('span', { class: 'ts-muted' }, 'Flesch–Kincaid grade'),
          el('span', { class: 'ts-value' }, stats.fleschKincaidGrade.toFixed(1)),
        ),
        el(
          'div',
          { class: 'ts-copy-row' },
          el('span', { class: 'ts-muted' }, 'Gunning Fog index'),
          el('span', { class: 'ts-value' }, stats.gunningFog.toFixed(1)),
        ),
      )
    }

    input.addEventListener('input', update)

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Text'), input),
        el('h3', { class: 'ts-subhead' }, 'Counts'),
        grid,
        el('h3', { class: 'ts-subhead' }, 'Readability'),
        readout,
        el('p', { class: 'ts-note' }, 'Analysis runs entirely in your browser.'),
      ),
    )

    update()
  },
}

export default tool
