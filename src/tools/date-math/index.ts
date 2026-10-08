import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { addDuration, countWeekdays, dayOfYear, diffDates, formatDate, isoWeek, parseDate, quarter, type Duration } from './date'

const DURATION_FIELDS: { key: keyof Duration; label: string }[] = [
  { key: 'years', label: 'Years' },
  { key: 'months', label: 'Months' },
  { key: 'weeks', label: 'Weeks' },
  { key: 'days', label: 'Days' },
  { key: 'hours', label: 'Hours' },
  { key: 'minutes', label: 'Minutes' },
]

function today(): string {
  return formatDate(new Date())
}

const tool: Tool = {
  slug: 'date-math',
  name: 'Date Calculator',
  description: 'Add or subtract durations from a date and measure the exact gap between two dates.',
  category: 'Numbers',
  keywords: ['date', 'days between', 'duration', 'add days', 'weekday', 'age', 'calendar', 'deadline'],
  render(root) {
    const start = el('input', { class: 'ts-input ts-mono', type: 'date', value: today() }) as HTMLInputElement
    const end = el('input', { class: 'ts-input ts-mono', type: 'date', value: today() }) as HTMLInputElement
    const durationInputs = DURATION_FIELDS.map((field) => ({ field, input: el('input', { class: 'ts-input ts-mono', type: 'number', value: field.key === 'days' ? '30' : '0', 'aria-label': field.label }) as HTMLInputElement }))
    const addResult = el('code', { class: 'ts-date-main' })
    const diffResult = el('div', { class: 'ts-date-grid' })
    const error = el('p', { class: 'ts-error', hidden: true })

    function duration(): Duration {
      const value: Duration = {}
      for (const { field, input } of durationInputs) value[field.key] = Number(input.value) || 0
      return value
    }

    function run() {
      addResult.textContent = ''
      diffResult.replaceChildren()
      try {
        const from = parseDate(start.value)
        const to = parseDate(end.value)
        const added = addDuration(from, duration())
        addResult.textContent = formatDate(added)
        error.hidden = true

        const diff = diffDates(from, to)
        const rows: [string, string][] = [
          ['Years, months, days', `${diff.years} y ${diff.months} m ${diff.days} d`],
          ['Total days', String(diff.totalDays)],
          ['Weeks and days', `${diff.weeks} w ${diff.remainderDays} d`],
          ['Total hours', String(diff.totalHours)],
          ['Total minutes', String(diff.totalMinutes)],
          ['Weekdays (Mon-Fri)', String(diff.weekdays)],
        ]
        for (const [label, value] of rows) {
          diffResult.append(el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, label), el('code', { class: 'ts-date-value' }, value), copyChip(value, 'Copy')))
        }
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not read those dates.'
        error.hidden = false
      }
    }

    function facts() {
      const value = el('div', { class: 'ts-date-facts' })
      try {
        const date = parseDate(start.value)
        const week = isoWeek(date)
        const rows: [string, string][] = [
          ['Weekday', date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })],
          ['Day of year', String(dayOfYear(date))],
          ['Quarter', `Q${quarter(date)}`],
          ['ISO week', `${week.year}-W${String(week.week).padStart(2, '0')}`],
          ['Weekdays in year', String(countWeekdays(parseDate(`${date.getUTCFullYear()}-01-01`), parseDate(`${date.getUTCFullYear()}-12-31`)))],
        ]
        for (const [label, text] of rows) value.append(el('div', { class: 'ts-date-fact' }, el('span', { class: 'ts-muted' }, label), el('strong', {}, text)))
      } catch {
        /* the main panel already shows the error */
      }
      return value
    }

    const factsBox = el('div')
    function refreshFacts() {
      factsBox.replaceChildren(facts())
    }

    start.addEventListener('input', () => {
      run()
      refreshFacts()
    })
    end.addEventListener('input', run)
    for (const { input } of durationInputs) input.addEventListener('input', run)

    const factsCopy = el('button', { class: 'ts-button', type: 'button', onclick: () => { end.value = start.value; run() } }, 'Use as end date')

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-two-col' },
          el(
            'div',
            { class: 'ts-field' },
            el('label', {}, 'Date'),
            start,
            factsBox,
            factsCopy,
          ),
          el('div', { class: 'ts-field' }, el('label', {}, 'End date'), end, el('h3', { class: 'ts-subhead' }, 'Difference'), diffResult),
        ),
        error,
        el('h3', { class: 'ts-subhead' }, 'Add or subtract'),
        el('div', { class: 'ts-date-duration' }, ...durationInputs.map(({ field, input }) => el('div', { class: 'ts-field' }, el('label', {}, field.label), input))),
        el('div', { class: 'ts-row ts-between' }, el('span', { class: 'ts-muted' }, 'Result'), addResult, copyChip(() => addResult.textContent ?? '', 'Copy')),
        el('p', { class: 'ts-note' }, 'All arithmetic is done in UTC so the answer is the same in every timezone. Month addition clamps to the last day, so 31 January plus one month is 28 or 29 February.'),
      ),
    )

    run()
    refreshFacts()
  },
}

export default tool
