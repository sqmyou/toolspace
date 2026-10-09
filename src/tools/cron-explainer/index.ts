import {

  card,
  cards,
  checkbox,
  chips,
  copyRow,
  field,
  grid,
  kvList,
  note,
  outputBlock,
  panel,
  segmented,
  textField,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { buildCron, FREQUENCIES, parseCron, presets, type Frequency, type ScheduleSpec } from './cron'

const DAY_LABELS = [
  { value: '0', label: 'Sun' },
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
]

const tool: Tool = {
  slug: 'cron-explainer',
  name: 'Cron Expression Explainer',
  description: 'Read a 5-field cron expression in plain English, build one visually, and see the next run times.',
  category: 'Web',
  keywords: ['cron', 'crontab', 'schedule', 'expression', 'explain', 'builder', 'cron expression'],
  render(root) {
    let mode: 'explain' | 'build' = 'explain'
    const input = textField({ value: '0 9 * * 1-5', mono: true, onInput: () => run() })
    input.spellcheck = false
    const error = note('', 'danger')
    error.hidden = true
    const summary = note('')
    const fields = cards()
    const nextRuns = kvList()

    /* ------------------------------- builder -------------------------------- */
    let frequency: Frequency = 'daily'
    const minute = textField({ type: 'number', value: '0', mono: true, onInput: () => build() })
    const hour = textField({ type: 'number', value: '9', mono: true, onInput: () => build() })
    const dayOfMonth = textField({ type: 'number', value: '1', mono: true, onInput: () => build() })
    const weekdayBoxes = DAY_LABELS.map((day) =>
      checkbox({ label: day.label, checked: day.value === '1', onChange: () => build() }),
    )
    const builtOutput = outputBlock('', { label: 'Expression', copy: () => builtValue })
    let builtValue = ''

    const frequencyControl = segmented({
      label: 'Runs',
      value: frequency,
      items: FREQUENCIES.map((item) => ({ value: item.value, label: item.label })),
      onChange: (value) => {
        frequency = value as Frequency
        build()
      },
    })

    const timeField = field(minute, { label: 'Minute (0–59)' })
    const hourField = field(hour, { label: 'Hour (0–23)' })
    const dayField = field(dayOfMonth, { label: 'Day of month (1–31)' })
    const weekdayField = grid(90, ...weekdayBoxes)

    function build() {
      const spec: ScheduleSpec = {
        frequency,
        minute: Number(minute.value) || 0,
        hour: Number(hour.value) || 0,
        dayOfMonth: Number(dayOfMonth.value) || 1,
        weekdays: weekdayBoxes
          .map((box, index) => ({ checked: (box.querySelector('input') as HTMLInputElement).checked, index }))
          .filter((entry) => entry.checked)
          .map((entry) => entry.index),
      }
      builtValue = buildCron(spec)
      builtOutput.body.replaceChildren(builtValue)
      const check = parseCron(builtValue)
      builtOutput.setMeta(check.valid ? check.description : check.error ?? '')

      const needsTime = frequency !== 'minutely'
      timeField.hidden = !needsTime
      hourField.hidden = frequency === 'hourly' || frequency === 'minutely'
      dayField.hidden = frequency !== 'monthly'
      weekdayField.hidden = frequency !== 'weekly'

      // Keep the explainer in step when a schedule is built.
      input.value = builtValue
      run()
    }

    function run() {
      const result = parseCron(input.value)
      error.hidden = result.valid
      if (!result.valid) {
        error.textContent = result.error ?? 'Invalid expression'
        summary.textContent = ''
        fields.replaceChildren()
        nextRuns.replaceChildren()
        return
      }
      summary.textContent = result.description
      fields.replaceChildren(...result.fields.map((item) => card({ title: item.name, meta: item.value }, item.description)))
      nextRuns.replaceChildren(
        ...result.next.map((date, index) => copyRow(`#${index + 1}`, date.toLocaleString(), { copy: false })),
      )
    }

    const explainPanel = panel(
      { title: 'Expression', icon: 'clock' },
      field(input, { label: 'Expression (minute hour day-of-month month day-of-week)' }),
      chips(presets().map((preset) => ({
        label: preset.label,
        title: preset.expression,
        onClick: () => {
          input.value = preset.expression
          run()
        },
      }))),
      error,
    )

    const buildPanel = panel(
      { title: 'Build', icon: 'sliders' },
      frequencyControl,
      grid(180, timeField, hourField),
      dayField,
      weekdayField,
      builtOutput,
    )
    buildPanel.hidden = true

    const modeControl = segmented({
      label: 'Mode',
      value: mode,
      items: [
        { value: 'explain', label: 'Explain' },
        { value: 'build', label: 'Build' },
      ],
      onChange: (value) => {
        mode = value as 'explain' | 'build'
        explainPanel.hidden = mode !== 'explain'
        buildPanel.hidden = mode !== 'build'
      },
    })

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'Mode', icon: 'grid' }, modeControl),
        explainPanel,
        buildPanel,
        panel({ title: 'In plain English', icon: 'text' }, summary),
        panel({ title: 'Fields', icon: 'layers' }, fields),
        panel({ title: 'Upcoming runs', icon: 'calendar' }, nextRuns),
      ),
    )

    build()
  },
}

export default tool
