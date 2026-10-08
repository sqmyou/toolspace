import { el } from '../../core/dom'
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
    const input = el('input', {
      class: 'ts-input ts-mono',
      value: nowSeconds(),
      spellcheck: false,
      'aria-label': 'Timestamp or date',
    }) as HTMLInputElement

    const error = el('p', { class: 'ts-error', hidden: true })
    const interpretation = el('span', { class: 'ts-muted' })
    const relative = el('span', { class: 'ts-badge ts-pass' })
    const summary = el('div', { class: 'ts-copy-list' })
    const zones = el('div', { class: 'ts-copy-list' })

    function copyRow(label: string, value: string) {
      const chip = el(
        'button',
        {
          class: 'ts-copy-chip',
          type: 'button',
          title: `Copy ${value}`,
          onclick: async () => {
            try {
              await navigator.clipboard.writeText(value)
              chip.textContent = 'Copied'
              setTimeout(() => (chip.textContent = value), 900)
            } catch {
              /* ignore */
            }
          },
        },
        value,
      )
      return el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, label), chip)
    }

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
        relative.className = 'ts-badge ' + (rel.deltaMs < 0 ? 'ts-warn' : 'ts-pass')

        summary.replaceChildren(
          copyRow('ISO', toIso(date)),
          copyRow('UTC', formatInZone(date, 'UTC').formatted),
          copyRow('Local', date.toLocaleString()),
          copyRow('Sec', String(Math.floor(date.getTime() / 1000))),
          copyRow('ms', String(date.getTime())),
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

    const nowButton = el('button', { class: 'ts-button', onclick: useNow }, 'Now')

    input.addEventListener('input', update)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Timestamp or date'), input),
        el('div', { class: 'ts-row ts-between' }, el('div', { class: 'ts-row' }, interpretation, relative), nowButton),
        error,
        el('h3', { class: 'ts-subhead' }, 'Values'),
        summary,
        el('h3', { class: 'ts-subhead' }, 'Same instant worldwide'),
        zones,
        el('p', { class: 'ts-note' }, 'Conversion uses your browser timezone data. Nothing is sent anywhere.'),
      ),
    )

    update()
  },
}

export default tool
