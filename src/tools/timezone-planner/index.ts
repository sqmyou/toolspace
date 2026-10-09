import {
  checkbox,
  copyRow,
  field,
  findingRow,
  note,
  panel,
  segmented,
  stat,
  stats,
  table,
  textField,
  toolLayout,
  type Chip,
  chips,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import {
  COMMON_ZONES,
  formatOffset,
  formatTime,
  offsetMinutes,
  planDay,
  todayIn,
  workingOverlaps,
  type Slot,
  type ZoneCandidate,
} from './timezone'

const DEFAULT_ZONES = ['UTC', 'Europe/London', 'America/New_York', 'Asia/Tokyo']

const tool: Tool = {
  slug: 'timezone-planner',
  name: 'Timezone Meeting Planner',
  description: 'Find a meeting time that works across timezones, with working-hour and awake-hour overlap.',
  category: 'Time',
  keywords: ['timezone', 'meeting', 'planner', 'overlap', 'utc', 'scheduling', 'world clock'],
  render(root) {
    const baseZone = COMMON_ZONES[0]
    const selected = new Set<string>(DEFAULT_ZONES)

    let base = baseZone.zone
    const dateInput = textField({ type: 'date', value: todayIn(baseZone.zone) })
    const baseSelect = segmented({
      label: 'Base zone',
      items: COMMON_ZONES.map((zone) => ({ value: zone.zone, label: zone.label })),
      value: baseZone.zone,
      onChange: (value) => {
        base = value
        run()
      },
    })
    baseSelect.classList.add('ts-tz-bases')

    const workStart = textField({ type: 'number', value: '9' })
    workStart.min = '0'
    workStart.max = '23'
    const workEnd = textField({ type: 'number', value: '18' })
    workEnd.min = '1'
    workEnd.max = '24'

    const zoneChecks = el('div', { class: 'ts-tz-zones' })
    const zonePresets = el('div', { class: 'ts-tz-presets' })
    const overlapGrid = el('div')
    const bestList = el('div', { class: 'ts-k-kvlist' })
    const nowList = el('div', { class: 'ts-k-kvlist' })
    const overlapSummary = stats()
    const nowStats = stats()

    function zoneLabel(zone: string): string {
      return COMMON_ZONES.find((item) => item.zone === zone)?.label ?? zone
    }

    function renderZoneChecks() {
      zoneChecks.replaceChildren(
        ...COMMON_ZONES.map((zone) =>
          checkbox({
            label: zone.label,
            checked: selected.has(zone.zone),
            onChange: (checked) => {
              if (checked) selected.add(zone.zone)
              else selected.delete(zone.zone)
              renderZoneChecks()
              run()
            },
          }),
        ),
      )
    }

    const presetChips: Chip[] = [
      { label: 'All', onClick: () => setZones(COMMON_ZONES.map((zone) => zone.zone)) },
      { label: 'Americas', onClick: () => setZones(['America/Los_Angeles', 'America/New_York', 'America/Sao_Paulo']) },
      { label: 'Europe & Africa', onClick: () => setZones(['Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Africa/Lagos']) },
      { label: 'Asia & Pacific', onClick: () => setZones(['Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney']) },
      { label: 'Clear', onClick: () => setZones([]) },
    ]

    function setZones(zones: string[]) {
      selected.clear()
      for (const zone of zones) selected.add(zone)
      renderZoneChecks()
      run()
    }

    zonePresets.replaceChildren(chips(presetChips))

    function chosenZones(): ZoneCandidate[] {
      return COMMON_ZONES.filter((zone) => selected.has(zone.zone))
    }

    /** Midnight in the chosen base zone, for the chosen calendar date. */
    function startInstant(): Date {
      const [year, month, day] = dateInput.value.split('-').map(Number)
      const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
      const guessOffset = offsetMinutes(noonUtc, base)
      const midnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - guessOffset * 60_000)
      // Re-resolve once: the offset at midnight may differ across a DST change.
      const refined = offsetMinutes(midnight, base)
      return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - refined * 60_000)
    }

    function renderNow() {
      const now = new Date()
      const zones = chosenZones()
      nowStats.replaceChildren(
        stat({ label: 'Zones', value: String(zones.length) }),
        stat({ label: 'Checked at', value: formatTime(now, base) }),
      )
      nowList.replaceChildren(
        ...zones.map((zone) =>
          copyRow(zone.label, () => `${formatTime(now, zone.zone)} · ${formatOffset(offsetMinutes(now, zone.zone))}`),
        ),
      )
      if (zones.length === 0) nowList.replaceChildren(el('p', { class: 'ts-k-hint' }, 'Choose at least one timezone.'))
    }

    function renderTable(slots: Slot[], zones: ZoneCandidate[]) {
      const rows = slots.map((slot) => {
        const row: Record<string, string | Node> = {
          base: el('span', { class: 'ts-tz-base' }, formatTime(slot.instant, base)),
        }
        for (const zone of zones) {
          const info = slot.hours[zone.zone]
          const dayTag = info.dayDifference > 0 ? ' +1' : info.dayDifference < 0 ? ' −1' : ''
          const cls = info.weekend ? 'ts-tz-weekend' : slot.allWorking ? 'ts-tz-work' : slot.allAwake ? 'ts-tz-awake' : 'ts-tz-night'
          row[zone.zone] = el('span', { class: cls }, `${String(info.hour).padStart(2, '0')}:${String(info.minute).padStart(2, '0')}${dayTag}`)
        }
        return row
      })
      overlapGrid.replaceChildren(
        table(
          [
            { key: 'base', label: `Time in ${zoneLabel(base)}` },
            ...zones.map((zone) => ({ key: zone.zone, label: zone.label, mono: true })),
          ],
          rows,
        ),
      )
    }

    function run() {
      const zones = chosenZones()
      renderNow()
      if (zones.length === 0) {
        overlapGrid.replaceChildren(el('p', { class: 'ts-k-hint' }, 'Choose at least one timezone to see the day.'))
        bestList.replaceChildren()
        overlapSummary.replaceChildren()
        return
      }

      const slots = planDay({
        start: startInstant(),
        baseZone: base,
        zones,
        workStart: Number(workStart.value),
        workEnd: Number(workEnd.value),
        awakeStart: 7,
        awakeEnd: 23,
        stepMinutes: 30,
      })

      renderTable(slots, zones)

      const overlaps = workingOverlaps(slots)
      const awakeSlots = slots.filter((slot) => slot.allAwake)
      overlapSummary.replaceChildren(
        stat({ label: 'Working overlap', value: `${overlaps.length * 30} min` }),
        stat({ label: 'Awake overlap', value: `${awakeSlots.length * 30} min` }),
        stat({ label: 'Best start', value: overlaps.length ? formatTime(overlaps[0].instant, base) : '—' }),
      )

      if (overlaps.length) {
        bestList.replaceChildren(
          ...overlaps.map((slot) =>
            copyRow(
              formatTime(slot.instant, base),
              zones
                .map((zone) => `${zone.label} ${String(slot.hours[zone.zone].hour).padStart(2, '0')}:${String(slot.hours[zone.zone].minute).padStart(2, '0')}`)
                .join(' · '),
            ),
          ),
        )
      } else {
        bestList.replaceChildren(
          findingRow({
            status: 'No fit',
            tone: 'warn',
            name: 'Working hours never line up',
            message: 'Try widening the working hours, dropping a timezone, or reading the awake-hours cells in the table above.',
          }),
        )
      }
    }

    dateInput.addEventListener('input', run)
    workStart.addEventListener('input', run)
    workEnd.addEventListener('input', run)

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'The meeting', icon: 'calendar' },
          el(
            'div',
            { class: 'ts-tz-controls' },
            field(dateInput, { label: 'Date', grow: true }),
            field(workStart, { label: 'Work from', grow: true }),
            field(workEnd, { label: 'Work until', grow: true }),
          ),
          el('div', { class: 'ts-k-field' }, el('span', { class: 'ts-k-label' }, 'Base zone'), baseSelect),
          note('Green cells sit inside everyone’s working hours, amber is a weekend, dim is outside awake hours. Times come from your browser’s timezone database.'),
        ),
        panel({ title: 'Timezones', icon: 'globe' }, zonePresets, zoneChecks),
        panel({ title: 'Right now', icon: 'clock' }, nowStats, nowList),
        panel({ title: 'Overlap for the day', icon: 'columns' }, overlapGrid),
        panel({ title: 'Best windows', icon: 'sparkle' }, overlapSummary, bestList),
      ),
    )

    renderZoneChecks()
    run()
  },
}

export default tool
