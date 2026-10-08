import {
  actions,
  button,
  note,
  panel,
  stat,
  stats,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { analyzeText, readingEaseLabel } from './stats'

const SAMPLE =
  'toolspace keeps every tool in your browser. Nothing you paste here is ever uploaded, ' +
  'which is the whole point: your text stays on your machine.'

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s'
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return minutes ? `${minutes}m ${rest}s` : `${rest}s`
}

/** Colour the readability score so a glance is enough to judge the text. */
function easeTone(score: number): 'ok' | 'warn' | 'danger' {
  if (score >= 60) return 'ok'
  if (score >= 30) return 'warn'
  return 'danger'
}

const tool: Tool = {
  slug: 'text-stats',
  name: 'Text Statistics & Readability',
  description: 'Count words, sentences and characters and score readability.',
  category: 'Text',
  keywords: ['word count', 'character count', 'readability', 'flesch', 'gunning fog', 'reading time'],
  render(root) {
    const input = textarea({
      rows: 8,
      placeholder: 'Paste text to analyse…',
      mono: false,
      onInput: () => update(),
    })

    const figures = stats()
    const readability = el('div', { class: 'ts-read-grid' })

    function score(label: string, value: string, hint: string, tone: 'ok' | 'warn' | 'danger') {
      return el(
        'div',
        { class: `ts-read ts-read--${tone}` },
        el('span', { class: 'ts-read__label' }, label),
        el('span', { class: 'ts-read__value ts-k-mono' }, value),
        el('span', { class: 'ts-read__hint' }, hint),
      )
    }

    function update() {
      const result = analyzeText(input.value)
      figures.replaceChildren(
        stat({ label: 'Words', value: String(result.words) }),
        stat({ label: 'Characters', value: String(result.characters), hint: `${result.charactersNoSpaces} without spaces` }),
        stat({ label: 'Sentences', value: String(result.sentences) }),
        stat({ label: 'Paragraphs', value: String(result.paragraphs) }),
        stat({ label: 'Unique words', value: String(result.uniqueWords) }),
        stat({ label: 'Lines', value: String(result.lines) }),
        stat({ label: 'Avg word length', value: result.averageWordLength.toFixed(1) }),
        stat({ label: 'Longest word', value: result.longestWord || '—' }),
        stat({ label: 'Reading time', value: formatDuration(result.readingSeconds) }),
        stat({ label: 'Speaking time', value: formatDuration(result.speakingSeconds) }),
      )
      readability.replaceChildren(
        score(
          'Flesch reading ease',
          result.fleschReadingEase.toFixed(1),
          readingEaseLabel(result.fleschReadingEase),
          easeTone(result.fleschReadingEase),
        ),
        score('Flesch–Kincaid grade', result.fleschKincaidGrade.toFixed(1), 'US school grade level', 'ok'),
        score('Gunning Fog index', result.gunningFog.toFixed(1), 'Years of formal education', 'ok'),
      )
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
                update()
              },
            }),
            button('Clear', {
              icon: 'x',
              onClick: () => {
                input.value = ''
                update()
              },
            }),
          ),
        ),
        panel({ title: 'Counts', icon: 'hash' }, figures),
        panel({ title: 'Readability', icon: 'eye' }, readability),
        note('Analysis runs entirely in your browser.'),
      ),
    )

    input.value = SAMPLE
    update()
  },
}

export default tool
