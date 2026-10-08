import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { formatClock, formatDuration, parseDuration, sumDurations } from './duration'

const EXAMPLES = ['1h30m', '2 days 4 hours', 'PT1H30M', '01:30', '90s']

const tool: Tool = {
  slug: 'duration-parser',
  name: 'Duration Parser',
  description: 'Read loose durations like "1h30m" or "P1DT2H" and convert them to every unit at once.',
  category: 'Numbers',
  keywords: ['duration', 'time', 'parse', 'iso 8601', 'hours', 'minutes', 'seconds', 'timespan'],
  render(root) {
    const input = el('input', { class: 'ts-input ts-mono', value: '1h30m', placeholder: '1h30m, 2 days 4 hours, PT1H30M, 01:30' }) as HTMLInputElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const primary = el('code', { class: 'ts-duration-main' })
    const list = el('div', { class: 'ts-copy-list' })
    let ms = 0

    function run() {
      list.replaceChildren()
      try {
        ms = parseDuration(input.value)
        primary.textContent = formatDuration(ms, { long: true })
        const rows: [string, string][] = [
          ['Milliseconds', String(Math.round(ms))],
          ['Seconds', String(ms / 1000)],
          ['Minutes', String(ms / 60000)],
          ['Hours', String(ms / 3600000)],
          ['Days', String(ms / 86400000)],
          ['Weeks', String(ms / 604800000)],
          ['Compact', formatDuration(ms)],
          ['Clock', formatClock(ms)],
        ]
        for (const [label, value] of rows) list.append(el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted ts-duration-name' }, label), el('code', { class: 'ts-duration-value' }, value), copyChip(value, 'Copy')))
        error.hidden = true
      } catch (err) {
        ms = 0
        primary.textContent = ''
        error.textContent = err instanceof Error ? err.message : 'Could not read that duration.'
        error.hidden = false
      }
    }

    input.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Duration'), input),
        el('div', { class: 'ts-row ts-wrap' }, ...EXAMPLES.map((example) => el('button', { class: 'ts-chip', type: 'button', onclick: () => { input.value = example; run() } }, example))),
        error,
        el('div', { class: 'ts-row ts-between' }, primary, copyChip(() => String(Math.round(ms)), 'Copy ms')),
        list,
        el('p', { class: 'ts-note' }, 'A bare number is read as seconds. Years are 365.25 days and months are 30.44 days, the same averages used by duration libraries.'),
      ),
    )

    run()
    void sumDurations
  },
}

export default tool
