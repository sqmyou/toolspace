import {
  actions,
  button,
  chips,
  copyButton,
  note,
  panel,
  stat,
  stats,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import {
  countText,
  evaluateLimits,
  formatDuration,
  letterFrequency,
  limitPlatforms,
  type CountResult,
  type LimitStatus,
} from './count'

const SAMPLE =
  'toolspace keeps every tool in your browser. Nothing you paste here is ever uploaded, ' +
  'which is the whole point: your text stays on your machine.'

const tool: Tool = {
  slug: 'letter-counter',
  name: 'Letter & Word Counter',
  description: 'Count letters, words, sentences and paragraphs live, and check them against platform limits.',
  category: 'Text',
  keywords: ['letter count', 'character count', 'word count', 'sentence count', 'twitter limit', 'meta description', 'seo', 'reading time'],
  render(root) {
    const input = textarea({ rows: 9, value: SAMPLE, placeholder: 'Start typing or paste text…', onInput: () => update() })
    const counts = stats()
    const freqGrid = el('div', { class: 'ts-letter-grid' })
    const limitBody = el('div', { class: 'ts-limit-list' })
    let platform = ''

    const platformBar = el('div')

    function selectPlatform(name: string) {
      platform = platform === name ? '' : name
      renderPlatforms()
      update()
    }

    function renderPlatforms() {
      platformBar.replaceChildren(
        chips(
          [
            { label: 'All platforms', value: '', active: platform === '', onClick: () => selectPlatform('') },
            ...limitPlatforms().map((name) => ({ label: name, value: name, active: platform === name, onClick: () => selectPlatform(name) })),
          ],
        ),
      )
    }

    function renderFrequency(value: string) {
      const top = letterFrequency(value)
      if (top.length === 0) {
        freqGrid.replaceChildren(el('p', { class: 'ts-k-hint' }, 'No letters yet.'))
        return
      }
      const max = top[0].count
      freqGrid.replaceChildren(
        ...top.map((entry) =>
          el(
            'div',
            { class: 'ts-letter' },
            el('span', { class: 'ts-letter-char' }, entry.letter),
            el(
              'span',
              { class: 'ts-letter-bar' },
              el('span', { class: 'ts-letter-fill', style: `width:${Math.max(6, (entry.count / max) * 100)}%` }),
            ),
            el('span', { class: 'ts-letter-count' }, String(entry.count)),
          ),
        ),
      )
    }

    function limitRow(status: LimitStatus) {
      const pct = Math.min(100, status.ratio * 100)
      return el(
        'div',
        { class: `ts-limit ts-limit-${status.state}` },
        el(
          'div',
          { class: 'ts-limit-head' },
          el('span', { class: 'ts-limit-field' }, status.field),
          el('span', { class: 'ts-limit-platform' }, status.platform),
          el(
            'span',
            { class: 'ts-limit-count' },
            status.kind === 'char' ? `${status.used} / ${status.limit}` : `${status.used} / ${status.limit} words`,
          ),
        ),
        el('div', { class: 'ts-limit-track' }, el('span', { class: 'ts-limit-fill', style: `width:${pct}%` })),
        el(
          'div',
          { class: 'ts-limit-foot' },
          el('span', { class: 'ts-k-hint' }, status.note),
          el('span', { class: 'ts-limit-remaining' }, status.remaining >= 0 ? `${status.remaining} left` : `${Math.abs(status.remaining)} over`),
        ),
      )
    }

    function update() {
      const result: CountResult = countText(input.value)
      counts.replaceChildren(
        stat({ label: 'Characters', value: String(result.characters) }),
        stat({ label: 'No spaces', value: String(result.charactersNoSpaces) }),
        stat({ label: 'Letters', value: String(result.letters) }),
        stat({ label: 'Words', value: String(result.words) }),
        stat({ label: 'Unique words', value: String(result.uniqueWords) }),
        stat({ label: 'Sentences', value: String(result.sentences) }),
        stat({ label: 'Paragraphs', value: String(result.paragraphs) }),
        stat({ label: 'Digits', value: String(result.digits) }),
        stat({ label: 'Punctuation', value: String(result.punctuation) }),
        stat({ label: 'Uppercase', value: String(result.upper) }),
        stat({ label: 'Lowercase', value: String(result.lower) }),
        stat({ label: 'Reading time', value: formatDuration(result.readingSeconds) }),
      )
      renderFrequency(input.value)
      limitBody.replaceChildren(...evaluateLimits(result, platform).map(limitRow))
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Your text', icon: 'text' },
          input,
          actions(
            copyButton(() => input.value, { label: 'Copy' }),
            button('Clear', { icon: 'x', onClick: () => { input.value = ''; update() } }),
          ),
        ),
        counts,
        panel({ title: 'Most-used letters', icon: 'chart' }, freqGrid),
        panel({ title: 'Platform limits', icon: 'ruler' }, platformBar, limitBody),
        note('Counting is character-based and treats CJK and emoji as you would expect. Everything runs locally.'),
      ),
    )

    renderPlatforms()
    update()
  },
}

export default tool
