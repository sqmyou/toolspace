import { actions, button, copyRow, note, panel, textField, toolLayout } from '../../core/components'
import type { Tool } from '../../core/types'
import {
  COMMON_ZONES,
  formatInZone,
  parseTimestamp,
  relativeTo,
  TimestampError,
  toIso,
} from './timestamp'

function nowSeconds(): string {
  return String(Math.floor(Date.now() / 1000))
}

const tool: Tool = {
  slug: 'timestamp',
  name: 'Timestamp Converter',
  description: 'Convert between Unix timestamps, ISO dates and human times across timezones.',
  category: 'Data',
  keywords: ['timestamp', 'epoch', 'unix', 'date', 'time', 'timezone', 'iso', 'utc'],
  render(root) {
    const input = textField({
      value: nowSeconds(),
      spellcheck: false,
      mono: true,
      onInput: () => update(),
    })

    const error = note('', 'danger')
    error.hidden = true
    const interpretation = document.createElement('span')
    interpretation.className = 'ts-k-hint'
    const relative = document.createElement('span')
    relative.className = 'ts-k-badge'

    const summary = document.createElement('div')
    summary.className = 'ts-k-kvlist'
    const zones = document.createElement('div')
    zones.className = 'ts-k-kvlist'

    function useNow() {
      input.value = nowSeconds()
      update()
    }

    function update() {
      try {
        const { date, interpretation: kind } = parseTimestamp(input.value)
        error.hidden = true
        interpretation.textContent = `Read as ${kind.toLowerCase()}`

        const rel = relativeTo(date)
        relative.textContent = rel.text
        relative.className = `ts-k-badge ts-k-badge--${rel.deltaMs < 0 ? 'warn' : 'ok'}`

        summary.replaceChildren(
          copyRow('ISO', toIso(date)),
          copyRow('UTC', formatInZone(date, 'UTC').formatted),
          copyRow('Local', date.toLocaleString()),
          copyRow('Seconds', String(Math.floor(date.getTime() / 1000))),
          copyRow('Milliseconds', String(date.getTime())),
        )

        zones.replaceChildren(
          ...COMMON_ZONES.map((zone) => {
            const formatted = formatInZone(date, zone)
            return copyRow(formatted.label, `${formatted.formatted}  ${formatted.offset}`)
          }),
        )
      } catch (err) {
        error.textContent = err instanceof TimestampError ? err.message : 'Could not read that value.'
        error.hidden = false
        interpretation.textContent = ''
        relative.textContent = ''
        summary.replaceChildren()
        zones.replaceChildren()
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Value', icon: 'clock' },
          input,
          actions(interpretation, relative, button('Now', { icon: 'refresh', onClick: useNow })),
        ),
        error,
        panel({ title: 'Same instant', icon: 'calendar' }, summary),
        panel({ title: 'Around the world', icon: 'globe' }, zones),
        note('Conversion uses your browser timezone data. Nothing is sent anywhere.'),
      ),
    )

    update()
  },
}

export default tool
