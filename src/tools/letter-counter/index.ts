import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
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
    const input = el('textarea', {
      class: 'ts-textarea',
      rows: 9,
      placeholder: 'Start typing or paste text…',
      'aria-label': 'Text to count',
      value: SAMPLE,
    }) as HTMLTextAreaElement

    const statGrid = el('div', { class: 'ts-stat-grid' })
    const freqGrid = el('div', { class: 'ts-letter-grid' })
    const platformBar = el('div', { class: 'ts-cat-bar', role: 'group', 'aria-label': 'Filter limits by platform' })
    const limitBody = el('div', { class: 'ts-limit-list' })
    let platform = ''

    function stat(label: string, value: string, hint?: string) {
      return el(
        'div',
        { class: 'ts-stat' },
        el('span', { class: 'ts-muted' }, label),
        el('span', { class: 'ts-stat-value' }, value),
        hint ? el('span', { class: 'ts-stat-hint' }, hint) : null,
      )
    }

    function renderStats(counts: CountResult) {
      statGrid.replaceChildren(
        stat('Characters', String(counts.characters)),
        stat('Characters (no spaces)', String(counts.charactersNoSpaces)),
        stat('Letters', String(counts.letters)),
        stat('Words', String(counts.words)),
        stat('Unique words', String(counts.uniqueWords)),
        stat('Sentences', String(counts.sentences)),
        stat('Paragraphs', String(counts.paragraphs)),
        stat('Digits', String(counts.digits)),
        stat('Punctuation', String(counts.punctuation)),
        stat('Uppercase', String(counts.upper)),
        stat('Lowercase', String(counts.lower)),
        stat('Reading time', formatDuration(counts.readingSeconds)),
      )
    }

    function renderFrequency(counts: CountResult) {
      const top = letterFrequency(input.value)
      if (top.length === 0) {
        freqGrid.replaceChildren(el('p', { class: 'ts-muted' }, 'No letters yet.'))
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
      void counts
    }

    function renderLimits(counts: CountResult) {
      const statuses = evaluateLimits(counts, platform)
      limitBody.replaceChildren(
        ...statuses.map((status) => limitRow(status)),
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
        el(
          'div',
          { class: 'ts-limit-track' },
          el('span', { class: 'ts-limit-fill', style: `width:${pct}%` }),
        ),
        el(
          'div',
          { class: 'ts-limit-foot' },
          el('span', { class: 'ts-muted' }, status.note),
          el(
            'span',
            { class: 'ts-limit-remaining' },
            status.remaining >= 0 ? `${status.remaining} left` : `${Math.abs(status.remaining)} over`,
          ),
        ),
      )
    }

    function renderPlatforms() {
      platformBar.replaceChildren(
        el(
          'button',
          {
            type: 'button',
            class: `ts-cat-chip ts-cat-chip-all${platform === '' ? ' is-active' : ''}`,
            onclick: () => {
              platform = ''
              renderPlatforms()
              update()
            },
          },
          'All platforms',
        ),
        ...limitPlatforms().map((name) =>
          el(
            'button',
            {
              type: 'button',
              class: `ts-cat-chip${platform === name ? ' is-active' : ''}`,
              onclick: () => {
                platform = platform === name ? '' : name
                renderPlatforms()
                update()
              },
            },
            name,
          ),
        ),
      )
    }

    function update() {
      const counts = countText(input.value)
      renderStats(counts)
      renderFrequency(counts)
      renderLimits(counts)
    }

    input.addEventListener('input', update)

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el(
          'div',
          { class: 'ts-field' },
          el(
            'div',
            { class: 'ts-row ts-between' },
            el('label', {}, 'Your text'),
            el(
              'div',
              { class: 'ts-tool-actions' },
              copyChip(() => input.value, 'Copy'),
              el('button', { type: 'button', class: 'ts-button', onclick: () => { input.value = ''; update() } }, 'Clear'),
            ),
          ),
          input,
        ),
        el('div', { class: 'ts-subhead' }, 'Counts'),
        statGrid,
        el('div', { class: 'ts-subhead' }, 'Most-used letters'),
        freqGrid,
        el('div', { class: 'ts-subhead' }, 'Platform limits'),
        platformBar,
        limitBody,
      ),
    )

    renderPlatforms()
    update()
  },
}

export default tool
