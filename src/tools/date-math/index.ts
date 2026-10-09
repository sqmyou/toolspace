import {
  actions,
  button,
  copyRow,
  field,
  grid,
  kvList,
  note,
  outputBlock,
  panel,
  stat,
  stats as statStrip,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
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
    const start = el('input', { class: 'ts-k-input ts-k-mono', type: 'date', value: today() }) as HTMLInputElement
    const end = el('input', { class: 'ts-k-input ts-k-mono', type: 'date', value: today() }) as HTMLInputElement
    const error = note('', 'danger')
    error.hidden = true
    const added = outputBlock('', { label: 'Date', copy: () => added.body.textContent ?? '' })
    const diffRows = kvList()
    const facts = statStrip()

    const durationInputs = DURATION_FIELDS.map((item) => ({
      item,
      input: el('input', {
        class: 'ts-k-input ts-k-mono',
        type: 'number',
        value: item.key === 'days' ? '30' : '0',
        'aria-label': item.label,
      }) as HTMLInputElement,
    }))

    function duration(): Duration {
      const value: Duration = {}
      for (const { item, input } of durationInputs) value[item.key] = Number(input.value) || 0
      return value
    }

    function run() {
      diffRows.replaceChildren()
      try {
        const from = parseDate(start.value)
        const to = parseDate(end.value)
        added.body.replaceChildren(formatDate(addDuration(from, duration())))
        added.setMeta('')
        error.hidden = true

        const diff = diffDates(from, to)
        const entries: [string, string][] = [
          ['Years, months, days', `${diff.years} y ${diff.months} m ${diff.days} d`],
          ['Total days', String(diff.totalDays)],
          ['Weeks and days', `${diff.weeks} w ${diff.remainderDays} d`],
          ['Total hours', String(diff.totalHours)],
          ['Total minutes', String(diff.totalMinutes)],
          ['Weekdays (Mon–Fri)', String(diff.weekdays)],
        ]
        diffRows.replaceChildren(...entries.map(([label, value]) => copyRow(label, value)))
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not read those dates.'
        error.hidden = false
      }
    }

    function refreshFacts() {
      facts.replaceChildren()
      try {
        const date = parseDate(start.value)
        const week = isoWeek(date)
        facts.append(
          stat({ label: 'Weekday', value: date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }) }),
          stat({ label: 'Day of year', value: String(dayOfYear(date)) }),
          stat({ label: 'Quarter', value: `Q${quarter(date)}` }),
          stat({ label: 'ISO week', value: `${week.year}-W${String(week.week).padStart(2, '0')}` }),
          stat({
            label: 'Weekdays in year',
            value: String(countWeekdays(parseDate(`${date.getUTCFullYear()}-01-01`), parseDate(`${date.getUTCFullYear()}-12-31`))),
          }),
        )
      } catch {
        /* the main panel already shows the error */
      }
    }

    start.addEventListener('input', () => {
      run()
      refreshFacts()
    })
    end.addEventListener('input', run)
    for (const { input } of durationInputs) input.addEventListener('input', run)

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Dates', icon: 'calendar' },
          grid(200, field(start, { label: 'Date' }), field(end, { label: 'End date' })),
          actions(button('Use start as end', { icon: 'swap', onClick: () => { end.value = start.value; run() } })),
          error,
        ),
        facts,
        panel({ title: 'Difference', icon: 'chart' }, diffRows),
        panel(
          { title: 'Add or subtract', icon: 'plus' },
          grid(90, ...durationInputs.map(({ item, input }) => field(input, { label: item.label }))),
        ),
        added,
        note('All arithmetic is done in UTC so the answer is the same in every timezone. Month addition clamps to the last day, so 31 January plus one month is 28 or 29 February.'),
      ),
    )

    run()
    refreshFacts()
  },
}

export default tool
