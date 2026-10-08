import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import {
  COMMON_ZONES,
  formatOffset,
  formatTime,

  offsetMinutes,
  planDay,
  todayIn,
  workingOverlaps,
  type ZoneCandidate,
} from './timezone'

const tool: Tool = {
  slug: 'timezone-planner',
  name: 'Timezone Meeting Planner',
  description: 'Find a meeting time that works across timezones, with working-hour and awake-hour overlap.',
  category: 'Time',
  keywords: ['timezone', 'meeting', 'planner', 'overlap', 'utc', 'scheduling', 'world clock'],
  render(root) {
    const baseZone = COMMON_ZONES[0]

    const selected = new Set<string>(['UTC', 'Europe/London', 'America/New_York', 'Asia/Tokyo'])
    const dateInput = el('input', { class: 'ts-input', type: 'date', value: todayIn(baseZone.zone) }) as HTMLInputElement
    const baseSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const zone of COMMON_ZONES) baseSelect.append(el('option', { value: zone.zone }, zone.label))

    const workStart = el('input', { class: 'ts-input', type: 'number', min: '0', max: '23', value: '9' }) as HTMLInputElement
    const workEnd = el('input', { class: 'ts-input', type: 'number', min: '1', max: '24', value: '18' }) as HTMLInputElement

    const zoneChecks = el('div', { class: 'ts-checkbox-grid' })
    const grid = el('div', { class: 'ts-grid-wrap' })
    const overlapList = el('div', { class: 'ts-copy-list' })
    const nowList = el('div', { class: 'ts-copy-list' })

    function zoneLabel(zone: string): string {
      return COMMON_ZONES.find((item) => item.zone === zone)?.label ?? zone
    }

    function renderZoneChecks() {
      zoneChecks.replaceChildren(
        ...COMMON_ZONES.map((zone) => {
          const box = el('input', { type: 'checkbox', checked: selected.has(zone.zone) }) as HTMLInputElement
          box.addEventListener('change', () => {
            if (box.checked) selected.add(zone.zone)
            else selected.delete(zone.zone)
            run()
          })
          return el('label', { class: 'ts-inline-field' }, box, zone.label)
        }),
      )
    }

    function chosenZones(): ZoneCandidate[] {
      return COMMON_ZONES.filter((zone) => selected.has(zone.zone))
    }

    /** Midnight in the chosen base zone, for the chosen calendar date. */
    function startInstant(): Date {
      const [year, month, day] = dateInput.value.split('-').map(Number)
      const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
      const guessOffset = offsetMinutes(noonUtc, baseSelect.value)
      const midnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - guessOffset * 60_000)
      // Re-resolve once: the offset at midnight may differ across a DST change.
      const refined = offsetMinutes(midnight, baseSelect.value)
      return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - refined * 60_000)
    }

    function renderNow() {
      const now = new Date()
      nowList.replaceChildren(
        ...chosenZones().map((zone) =>
          el(
            'div',
            { class: 'ts-copy-row' },
            el('span', { class: 'ts-muted' }, zone.label),
            el('code', { class: 'ts-mono ts-value' }, `${formatTime(now, zone.zone)} · ${formatOffset(offsetMinutes(now, zone.zone))}`),
            copyChip(() => `${zone.label}: ${formatTime(now, zone.zone)} ${formatOffset(offsetMinutes(now, zone.zone))}`),
          ),
        ),
      )
    }

    function run() {
      const zones = chosenZones()
      renderNow()
      if (zones.length === 0) {
        grid.replaceChildren(el('p', { class: 'ts-muted' }, 'Choose at least one timezone.'))
        overlapList.replaceChildren()
        return
      }

      const slots = planDay({
        start: startInstant(),
        baseZone: baseSelect.value,
        zones,
        workStart: Number(workStart.value),
        workEnd: Number(workEnd.value),
        awakeStart: 7,
        awakeEnd: 23,
        stepMinutes: 30,
      })

      const table = el('table', { class: 'ts-table' })
      const head = el('tr', {}, el('th', {}, `Time in ${zoneLabel(baseSelect.value)}`))
      for (const zone of zones) head.append(el('th', {}, zone.label))
      table.append(el('thead', {}, head))

      const body = el('tbody')
      for (const slot of slots) {
        const tr = el('tr')
        const baseTime = formatTime(slot.instant, baseSelect.value)
        tr.append(el('td', { class: 'ts-mono' }, baseTime))
        for (const zone of zones) {
          const info = slot.hours[zone.zone]
          const dayTag = info.dayDifference > 0 ? ' (+1)' : info.dayDifference < 0 ? ' (−1)' : ''
          const cellClass = info.weekend ? 'ts-tz-weekend' : slot.allWorking ? 'ts-tz-work' : slot.allAwake ? '' : 'ts-tz-night'
          tr.append(el('td', { class: `ts-mono ${cellClass}` }, `${String(info.hour).padStart(2, '0')}:${String(info.minute).padStart(2, '0')}${dayTag}`))
        }
        if (slot.allWorking) tr.classList.add('ts-tz-best')
        body.append(tr)
      }
      table.append(body)
      grid.replaceChildren(el('div', { class: 'ts-table-wrap' }, table))

      const overlaps = workingOverlaps(slots)
      const nodes: Node[] = []
      if (overlaps.length) {
        nodes.push(el('p', { class: 'ts-muted' }, `${overlaps.length} half-hour slots where everyone is in working hours`))
        for (const slot of overlaps) {
          nodes.push(
            el(
              'div',
              { class: 'ts-copy-row' },
              el('code', { class: 'ts-mono ts-value' }, formatTime(slot.instant, baseSelect.value)),
              el('span', { class: 'ts-muted' }, zones.map((zone) => `${zone.label} ${String(slot.hours[zone.zone].hour).padStart(2, '0')}:${String(slot.hours[zone.zone].minute).padStart(2, '0')}`).join(' · ')),
            ),
          )
        }
      } else {
        nodes.push(
          el('div', { class: 'ts-audit ts-audit-warning' }, 'No slot works for everyone within working hours. Try widening the hours, dropping a zone, or using the awake-hours view in the table.'),
        )
      }
      overlapList.replaceChildren(...nodes)
    }

    for (const input of [dateInput, baseSelect, workStart, workEnd]) input.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Date'), dateInput),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Base zone'), baseSelect),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Work from'), workStart),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Work until'), workEnd),
        ),
        el('h3', { class: 'ts-subhead' }, 'Timezones'),
        zoneChecks,
        el('h3', { class: 'ts-subhead' }, 'Right now'),
        nowList,
        el('h3', { class: 'ts-subhead' }, 'Overlap for the day'),
        grid,
        el('h3', { class: 'ts-subhead' }, 'Best windows'),
        overlapList,
        el('p', { class: 'ts-note' }, 'Green cells are inside everyone’s working hours; dim cells are outside awake hours. Times come from your browser’s timezone database.'),
      ),
    )

    renderZoneChecks()
    run()
  },
}

export default tool
