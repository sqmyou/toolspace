import { button, copyRow, note, panel, section, select, stat, toolLayout } from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { dayOfYear, formatInZone, isoDate, isoTime, isoTimestamp, isoWeek, localParts, localZone, zoneInfo } from './clock'

const ZONES = [
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Australia/Sydney',
]

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const tool: Tool = {
  slug: 'atomic-clock',
  name: 'Atomic Clock',
  description: 'A millisecond-precision clock with UTC, ISO timestamps, week numbers and a world-time board — all read locally.',
  category: 'Time',
  keywords: ['clock', 'time', 'atomic', 'utc', 'iso 8601', 'timestamp', 'timezone', 'world clock', 'week number'],
  render(root) {
    const big = el('div', { class: 'ts-clock-face' }, '--:--:--')
    const bigMillis = el('span', { class: 'ts-clock-millis' }, '.000')
    big.append(bigMillis)

    const dateLine = el('div', { class: 'ts-clock-date' }, '')
    const zoneLine = el('div', { class: 'ts-clock-zone' }, '')

    const isoRow = el('div', { class: 'ts-k-kvlist' })
    const partsRow = el('div', { class: 'ts-k-stats' })

    const zoneSelect = select({
      label: 'Compare with another zone',
      value: localZone(),
      options: [
        { value: localZone(), label: `${localZone()} (local)` },
        ...ZONES.filter((z) => z !== localZone()).map((z) => ({ value: z, label: z })),
      ],
      onChange: () => paint(),
    })
    zoneSelect.setAttribute('aria-label', 'Compare with another time zone')
    const otherTime = el('div', { class: 'ts-clock-other' }, '--:--:--')
    const otherZone = el('div', { class: 'ts-clock-otherzone' }, '')

    const worldList = el('div', { class: 'ts-clock-world' })


    function paint() {
      const now = new Date()
      const parts = localParts(now)

      big.firstChild!.textContent = isoTime(parts, false)
      bigMillis.textContent = `.${String(parts.millisecond).padStart(3, '0')}`

      const week = isoWeek(now)
      dateLine.textContent = `${WEEKDAYS[parts.weekday]}, ${parts.day} ${monthName(parts.month)} ${parts.year}`
      const info = zoneInfo(localZone(), now)
      zoneLine.textContent = `${info.name} · ${info.offset}`

      isoRow.replaceChildren(
        copyRow('ISO 8601 (UTC)', isoTimestamp(now)),
        copyRow('ISO 8601 (local)', `${isoDate(parts)}T${isoTime(parts)}`),
        copyRow('Unix seconds', String(Math.floor(now.getTime() / 1000))),
        copyRow('Unix millis', String(now.getTime())),
      )

      partsRow.replaceChildren(
        stat({ label: 'ISO week', value: `W${String(week.week).padStart(2, '0')}`, hint: `${week.year}` }),
        stat({ label: 'Day of year', value: String(dayOfYear(parts.year, parts.month, parts.day)) }),
        stat({ label: 'Days in month', value: String(daysInThisMonth(parts.year, parts.month)) }),
      )

      const zone = zoneSelect.value
      otherTime.textContent = formatInZone(now, zone)
      otherZone.textContent = `${zone} · ${zoneInfo(zone, now).offset}`

    }

    function daysInThisMonth(year: number, month: number): number {
      return new Date(year, month, 0).getDate()
    }

    const pause = button('Pause', { icon: 'play', onClick: () => toggle() })
    let timer = 0
    let paused = false

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    function schedule() {
      clearInterval(timer)
      // Reduced motion still gets fresh values, just without a 40ms ticker.
      timer = window.setInterval(() => {
        paint()
        paintWorld()
      }, paused ? 1000 : reduced ? 1000 : 40)
    }

    function toggle() {
      paused = !paused
      pause.querySelector('span')!.textContent = paused ? 'Resume' : 'Pause'
      schedule()
    }

    function paintWorld() {
      const now = new Date()
      worldList.replaceChildren(
        ...ZONES.map((zone) =>
          el(
            'div',
            { class: 'ts-clock-worldrow' },
            el('span', { class: 'ts-clock-worldrow__zone' }, zone),
            el('span', { class: 'ts-clock-worldrow__time' }, formatInZone(now, zone)),
            el('span', { class: 'ts-clock-worldrow__offset' }, zoneInfo(zone, now).offset),
          ),
        ),
      )
    }

    paint()
    paintWorld()
    schedule()

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Local time', icon: 'clock', meta: 'system clock' },
          big,
          dateLine,
          zoneLine,
          el('div', { class: 'ts-k-actions' }, pause),
        ),
        panel({ title: 'Exact values', icon: 'hash', meta: 'copyable' }, isoRow, partsRow),
        panel(
          { title: 'Compare a zone', icon: 'globe' },
          zoneSelect,
          otherTime,
          otherZone,
        ),
        panel({ title: 'World time', icon: 'calendar' }, worldList),
        section(
          'About "atomic"',
          note(
            'A browser cannot read an atomic clock without asking a time server, and toolspace does not make that request. This is your device\'s clock, which the operating system keeps synchronised, read to the millisecond and shown in every useful form. For a figure that must be traceable to a standards body, compare it with an official time service.',
          ),
        ),
      ),
    )
  },
}

function monthName(month: number): string {
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month - 1] ?? ''
}

export default tool
