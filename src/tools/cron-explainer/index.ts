import {

  card,
  cards,
  chips,
  copyRow,
  field,
  kvList,
  note,
  panel,
  textField,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { parseCron, presets } from './cron'

const tool: Tool = {
  slug: 'cron-explainer',
  name: 'Cron Expression Explainer',
  description: 'Read a 5-field cron expression in plain English and see its next run times.',
  category: 'Web',
  keywords: ['cron', 'crontab', 'schedule', 'expression', 'explain', 'cron expression'],
  render(root) {
    const input = textField({ value: '0 9 * * 1-5', mono: true, onInput: () => run() })
    input.spellcheck = false
    const error = note('', 'danger')
    error.hidden = true
    const summary = note('')
    const fields = cards()
    const nextRuns = kvList()

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

    root.append(
      toolLayout(
        { wide: true },
        panel(
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
        ),
        panel({ title: 'In plain English', icon: 'text' }, summary),
        panel({ title: 'Fields', icon: 'layers' }, fields),
        panel({ title: 'Upcoming runs', icon: 'calendar' }, nextRuns),
        note('Parsing and the next-run search run entirely in your browser.'),
      ),
    )

    run()
  },
}

export default tool
