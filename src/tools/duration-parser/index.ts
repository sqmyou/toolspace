import {
  chips,
  copyRow,
  kvList,
  note,
  outputBlock,
  panel,
  textField,
  toolLayout,
} from '../../core/components'
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
    const input = textField({
      value: '1h30m',
      mono: true,
      placeholder: '1h30m, 2 days 4 hours, PT1H30M, 01:30',
      onInput: () => run(),
    })

    const error = note('', 'danger')
    error.hidden = true
    const primary = outputBlock('', { label: 'Duration', copy: () => String(Math.round(ms)) })
    const rows = kvList()
    let ms = 0

    function run() {
      try {
        ms = parseDuration(input.value)
        primary.body.replaceChildren(formatDuration(ms, { long: true }))
        primary.setMeta(formatClock(ms))
        primary.setLabel('Duration')
        const values: [string, string][] = [
          ['Milliseconds', String(Math.round(ms))],
          ['Seconds', String(ms / 1000)],
          ['Minutes', String(ms / 60000)],
          ['Hours', String(ms / 3600000)],
          ['Days', String(ms / 86400000)],
          ['Weeks', String(ms / 604800000)],
          ['Compact', formatDuration(ms)],
          ['Clock', formatClock(ms)],
        ]
        rows.replaceChildren(...values.map(([label, value]) => copyRow(label, value)))
        error.hidden = true
      } catch (err) {
        ms = 0
        primary.body.replaceChildren('')
        primary.setMeta('')
        rows.replaceChildren()
        error.textContent = err instanceof Error ? err.message : 'Could not read that duration.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Duration', icon: 'clock' },
          input,
          chips(EXAMPLES.map((example) => ({ label: example, onClick: (value) => { input.value = value; run() } }))),
          error,
        ),
        primary,
        panel({ title: 'Every unit', icon: 'layers' }, rows),
        note('A bare number is read as seconds. Years are 365.25 days and months are 30.44 days, the same averages used by duration libraries.'),
      ),
    )

    run()
    void sumDurations
  },
}

export default tool
