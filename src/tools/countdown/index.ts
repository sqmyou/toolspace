import { button, chips, field, note, panel, stat, stats, textField, toolLayout } from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { alarmPattern, formatClock, formatHuman, parseDuration, progress } from './countdown'

const PRESETS = [
  { value: '1m', label: '1 min' },
  { value: '3m', label: '3 min' },
  { value: '5m', label: '5 min' },
  { value: '10m', label: '10 min' },
  { value: '25m', label: 'Pomodoro' },
  { value: '1h', label: '1 hour' },
]

const tool: Tool = {
  slug: 'countdown',
  name: 'Countdown Timer',
  description: 'A precise countdown with presets, a progress ring and an optional chime — it keeps time even if the tab is throttled.',
  category: 'Time',
  keywords: ['countdown', 'timer', 'pomodoro', 'alarm', 'interval', 'stopwatch', 'focus', 'egg timer'],
  render(root) {
    const input = textField({ value: '5m', mono: true, onInput: () => {} })
    input.setAttribute('aria-label', 'Countdown duration, for example 5m or 1:30')

    const clock = el('div', { class: 'ts-cd-clock' }, '05:00')
    const humanLabel = el('div', { class: 'ts-cd-human' }, '')
    const ring = el('div', { class: 'ts-cd-ring' })

    const status = el('p', { class: 'ts-cd-status', role: 'status', 'aria-live': 'polite' }, 'Set a time, then start.')

    const statsRow = stats(
      el('div', { class: 'ts-k-stat' }, el('span', { class: 'ts-k-stat__value ts-k-mono' }, '0%'), el('span', { class: 'ts-k-stat__label' }, 'Elapsed')),
    )

    const chimeToggle = el('input', { type: 'checkbox', checked: true, id: 'ts-cd-chime' }) as HTMLInputElement
    chimeToggle.setAttribute('aria-label', 'Play a chime when the countdown ends')

    let totalMs = 300000
    let remainingMs = 300000
    let running = false
    let lastTick = 0
    let raf = 0
    let audio: AudioContext | null = null

    function setStatus(text: string, tone: 'idle' | 'run' | 'done' = 'idle') {
      status.textContent = text
      status.dataset.tone = tone
    }

    function paint() {
      clock.textContent = formatClock(remainingMs)
      humanLabel.textContent = formatHuman(remainingMs)
      const done = progress(remainingMs, totalMs)
      ring.style.setProperty('--ts-cd-progress', `${done * 100}%`)
      statsRow.replaceChildren(
        stat({ label: 'Elapsed', value: `${Math.round(done * 100)}%` }),
        stat({ label: 'Remaining', value: formatHuman(remainingMs) }),
        stat({ label: 'Total', value: formatHuman(totalMs) }),
      )
      // "Final countdown" is the last ten seconds, but never the whole run —
      // a 10-second timer should not look urgent from the first frame.
      clock.classList.toggle('is-low', running && remainingMs <= 10000 && totalMs > 10000)
    }

    function applyPreset(raw: string) {
      try {
        totalMs = parseDuration(raw)
        remainingMs = totalMs
        input.value = raw
        paint()
        setStatus('Ready.')
      } catch {
        setStatus('That is not a duration I understand.')
      }
    }

    function beep() {
      if (!chimeToggle.checked) return
      try {
        audio = audio ?? new AudioContext()
        // A resumed context inside the click gesture is allowed everywhere.
        void audio.resume()
        for (const tone of alarmPattern()) {
          const osc = audio.createOscillator()
          const gain = audio.createGain()
          osc.type = 'sine'
          osc.frequency.value = tone.frequency
          const start = audio.currentTime + tone.delayMs / 1000
          const end = start + tone.durationMs / 1000
          gain.gain.setValueAtTime(0.0001, start)
          gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.0001, end)
          osc.connect(gain).connect(audio.destination)
          osc.start(start)
          osc.stop(end + 0.02)
        }
      } catch {
        // Audio is a nicety; a blocked context must not break the timer.
      }
    }

    function finish() {
      running = false
      remainingMs = 0
      paint()
      setStatus('Time is up.', 'done')
      clock.classList.add('is-done')
      beep()
    }

    function frame(now: number) {
      if (!running) return
      const delta = now - lastTick
      lastTick = now
      remainingMs -= delta
      if (remainingMs <= 0) {
        finish()
        return
      }
      paint()
      raf = requestAnimationFrame(frame)
    }

    function start() {
      if (running) return
      if (remainingMs <= 0) applyPreset(input.value)
      if (remainingMs <= 0) return
      running = true
      clock.classList.remove('is-done')
      lastTick = performance.now()
      setStatus('Counting down…', 'run')
      raf = requestAnimationFrame(frame)
    }

    function pause() {
      if (!running) return
      running = false
      cancelAnimationFrame(raf)
      setStatus('Paused.')
    }

    function reset() {
      running = false
      cancelAnimationFrame(raf)
      try {
        totalMs = parseDuration(input.value)
      } catch {
        setStatus('That is not a duration I understand.')
        return
      }
      remainingMs = totalMs
      clock.classList.remove('is-done')
      paint()
      setStatus('Ready.')
    }

    function add(ms: number) {
      remainingMs = Math.max(0, remainingMs + ms)
      totalMs = Math.max(totalMs, remainingMs)
      paint()
    }

    const startBtn = button('Start', { icon: 'play', variant: 'primary', onClick: () => start() })
    const pauseBtn = button('Pause', { icon: 'minus', onClick: () => pause() })
    const resetBtn = button('Reset', { icon: 'refresh', onClick: () => reset() })

    input.addEventListener('change', () => reset())
    input.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Enter') reset()
    })

    const presetRow = chips(
      PRESETS.map((preset) => ({
        value: preset.value,
        label: preset.label,
        onClick: (value: string) => applyPreset(value),
      })),
    )

    paint()

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Countdown', icon: 'clock', meta: 'runs offline' },
          el('div', { class: 'ts-cd-face' }, ring, el('div', { class: 'ts-cd-readout' }, clock, humanLabel)),
          el('div', { class: 'ts-k-actions' }, startBtn, pauseBtn, resetBtn),
          el(
            'div',
            { class: 'ts-cd-add' },
            button('+1m', { onClick: () => add(60000) }),
            button('+5m', { onClick: () => add(300000) }),
            button('−1m', { onClick: () => add(-60000) }),
          ),
          status,
        ),
        panel({ title: 'Set the time', icon: 'sliders' }, presetRow, field(input, { label: 'Duration' }), el('label', { class: 'ts-cd-chime' }, chimeToggle, 'Chime when finished')),
        statsRow,
        note(
          'The countdown measures real elapsed time with requestAnimationFrame, so a throttled background tab still finishes on schedule — it corrects for the gap when it next wakes. The chime is generated with the Web Audio API; there is no audio file and no request. Nothing leaves the tab.',
        ),
      ),
    )
  },
}

export default tool
