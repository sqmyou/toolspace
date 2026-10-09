import { badge, note, panel, section, stat, stats, toolLayout } from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { averageCps, bestCps, clicksInWindow, consistency, extremes, intervals } from './click'

const DURATION = 10 // seconds

const tool: Tool = {
  slug: 'click-speed-test',
  name: 'Click Speed Test',
  description: 'Measure your clicks per second over ten seconds, with a live counter, your best second and how steady you stayed.',
  category: 'Numbers',
  keywords: ['click', 'cps', 'speed', 'test', 'mouse', 'cps test', 'kohi', 'reaction', 'apm'],
  render(root) {
    const pad = el('button', { class: 'ts-cps-pad', type: 'button' }) as HTMLButtonElement
    pad.setAttribute('aria-label', 'Click here as fast as you can once the test starts')

    const padBig = el('span', { class: 'ts-cps-pad__count' }, '0')
    const padHint = el('span', { class: 'ts-cps-pad__hint' }, 'Click to start')
    pad.append(padBig, padHint)

    const remaining = el('div', { class: 'ts-cps-timer' }, `${DURATION.toFixed(1)}s left`)
    const bar = el('div', { class: 'ts-cps-bar__fill' })
    const barWrap = el('div', { class: 'ts-cps-bar', 'aria-hidden': 'true' }, bar)

    const liveCps = el('span', { class: 'ts-k-stat__value ts-k-mono' }, '0.0')
    const liveClicks = el('span', { class: 'ts-k-stat__value ts-k-mono' }, '0')
    const liveStrip = stats(
      el('div', { class: 'ts-k-stat' }, liveCps, el('span', { class: 'ts-k-stat__label' }, 'CPS now')),
      el('div', { class: 'ts-k-stat' }, liveClicks, el('span', { class: 'ts-k-stat__label' }, 'Clicks')),
    )

    const results = el('div', { class: 'ts-cps-results' })
    results.hidden = true
    const grade = el('div', { class: 'ts-cps-grade' })

    let running = false
    let started = 0
    let raf = 0
    let timestamps: number[] = []

    function reset() {
      running = false
      cancelAnimationFrame(raf)
      timestamps = []
      padBig.textContent = '0'
      padHint.textContent = 'Click to start'
      remaining.textContent = `${DURATION.toFixed(1)}s left`
      bar.style.width = '0%'
      pad.classList.remove('is-running', 'is-done')
      liveCps.textContent = '0.0'
      liveClicks.textContent = '0'
      results.hidden = true
    }

    function finish() {
      running = false
      pad.classList.remove('is-running')
      pad.classList.add('is-done')
      padHint.textContent = 'Click to try again'

      const best = bestCps(timestamps, 1000)
      const average = averageCps(timestamps, 1000)
      const gaps = intervals(timestamps)
      const spread = extremes(gaps)
      const steady = consistency(gaps)

      grade.textContent = gradeFor(best)
      results.replaceChildren(
        stats(
          stat({ label: 'Best second', value: `${best.toFixed(1)} CPS` }),
          stat({ label: 'Average', value: `${average.toFixed(1)} CPS` }),
          stat({ label: 'Total clicks', value: String(timestamps.length) }),
          stat({ label: 'Consistency', value: `${Math.round(steady)}%`, hint: 'How evenly you clicked' }),
        ),
        stats(
          stat({ label: 'Fastest gap', value: `${Math.round(spread.shortest)} ms` }),
          stat({ label: 'Slowest gap', value: `${Math.round(spread.longest)} ms` }),
          stat({ label: 'Best window', value: '1.0 s', hint: 'Rolling, not fixed' }),
        ),
      )
      results.hidden = false
    }

    function tick() {
      if (!running) return
      const now = performance.now()
      const elapsed = now - started
      const left = Math.max(0, DURATION * 1000 - elapsed)

      remaining.textContent = `${(left / 1000).toFixed(1)}s`
      bar.style.width = `${Math.min(100, (elapsed / (DURATION * 1000)) * 100)}%`
      liveCps.textContent = ((clicksInWindow(timestamps, 1000, now) * 1000) / 1000).toFixed(1)
      liveClicks.textContent = String(timestamps.length)

      if (left <= 0) {
        finish()
        return
      }
      raf = requestAnimationFrame(tick)
    }

    function clickPad() {
      if (!running) {
        // A finished run needs a fresh start; a click during a run is a click.
        if (pad.classList.contains('is-done') || timestamps.length === 0) {
          reset()
          running = true
          started = performance.now()
          pad.classList.add('is-running')
          padHint.textContent = 'Keep clicking'
          raf = requestAnimationFrame(tick)
        } else {
          return
        }
      }
      timestamps.push(performance.now())
      padBig.textContent = String(timestamps.length)
      // Reduced-motion users still get the live count; only the pop is dropped.
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        padBig.classList.remove('is-pop')
        void padBig.offsetWidth
        padBig.classList.add('is-pop')
      }
    }

    pad.addEventListener('click', clickPad)

    // Keyboard: the pad is a button, so Enter and Space already fire click.
    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Ten-second test', icon: 'bolt', meta: `${DURATION}s`, fill: true },
          remaining,
          barWrap,
          pad,
          liveStrip,
        ),
        results,
        section(
          'How it is scored',
          note(
            'Every click is timestamped with performance.now(), a clock that cannot jump if the system time changes. CPS "now" is a rolling one-second window, so it never dips below what you did in the last second. Best second is the highest CPS across any rolling second of the run — a fairer headline than the average, which a slow start drags down. Consistency is 100 × mean ÷ (mean + standard deviation) of your gaps: even clicking scores high, spiky clicking scores low. All of this runs in the tab; no click ever leaves it.',
          ),
        ),
        badge('Runs locally', 'ok'),
      ),
    )

    reset()
  },
}

/** A friendly label for a best-second figure. */
function gradeFor(best: number): string {
  if (best >= 10) return 'Lightning'
  if (best >= 8) return 'Very fast'
  if (best >= 6) return 'Fast'
  if (best >= 4) return 'Average'
  if (best > 0) return 'Getting there'
  return 'No clicks'
}

export default tool
