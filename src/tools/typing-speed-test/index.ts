import { button, note, panel, section, stat, stats, toolLayout } from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import {
  characters,
  consistencyFrom,
  keystrokeStats,
  linearTrend,
  perSecondSeries,
  shuffled,
  weakKeys,
  type KeyEvent,
} from './typing'

/** A small common-word bank — enough variety that a run never feels looped. */
const BANK = (
  'the be to of and a in that have I it for not on with he as you do at this but his by from they we say her she or an will ' +
  'my one all would there their what so up out if about who get which go me when make can like time no just him know take ' +
  'people into year your good some could them see other than then now look only come its over think also back after use two ' +
  'how our work first well way even new want because any these give day most us is are was were has had did does been being ' +
  'where why while before around through between under again always never often still much many few own same each every next ' +
  'last long short small large great little early late open close start stop build write read learn teach run walk move find'
).split(/\s+/)

const PUNCTUATION = ['.', ',', ';', ':', '!', '?', "'"]

const QUOTES = [
  'The best way to predict the future is to invent it, and the second best is to measure it carefully first.',
  'Programs must be written for people to read, and only incidentally for machines to execute.',
  'Simplicity is a great virtue but it requires hard work to achieve it and education to appreciate it.',
  'A language that does not affect the way you think about programming is not worth knowing at all.',
]

type Mode = 'time' | 'words'
type Duration = 15 | 30 | 60 | 120

const PB_KEY = 'toolspace:typing-pb'
/** Lines of text kept in view; the third is the lookahead. */
const VISIBLE_LINES = 3

/** A uniform integer in [0, max) from the platform CSPRNG. */
function randomInt(max: number): number {
  if (max <= 0) return 0
  const limit = Math.floor(0xffffffff / max) * max
  const buffer = new Uint32Array(1)
  let value = 0
  do {
    crypto.getRandomValues(buffer)
    value = buffer[0]
  } while (value >= limit)
  return value % max
}

function readBest(): number {
  try {
    const parsed = JSON.parse(localStorage.getItem(PB_KEY) ?? 'null') as { wpm?: number } | null
    return typeof parsed?.wpm === 'number' && Number.isFinite(parsed.wpm) ? parsed.wpm : 0
  } catch {
    return 0
  }
}

function writeBest(wpm: number): void {
  try {
    localStorage.setItem(PB_KEY, JSON.stringify({ wpm, at: Date.now() }))
  } catch {
    /* storage can be unavailable — a personal best is a nicety, not a requirement */
  }
}

/** Draw the speed-over-time chart as a numbers-only SVG string, so it is injection-safe. */
function chartSvg(samples: { second: number; wpm: number }[]): string {
  if (samples.length < 2) return ''
  const width = 640
  const height = 160
  const padX = 10
  const padY = 14
  const values = samples.map((sample) => sample.wpm)
  const peak = Math.max(20, ...values)
  const step = (width - padX * 2) / (samples.length - 1)
  const x = (index: number) => padX + index * step
  const y = (value: number) => height - padY - (value / peak) * (height - padY * 2)

  const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`)
  const area = `M ${padX},${height - padY} L ${points.join(' L ')} L ${x(values.length - 1).toFixed(1)},${height - padY} Z`
  const bars = values
    .map((value, index) => {
      const top = y(value)
      return `<rect class="ts-type-chart__bar" x="${(x(index) - step * 0.28).toFixed(1)}" y="${top.toFixed(1)}" width="${(step * 0.56).toFixed(1)}" height="${(height - padY - top).toFixed(1)}" rx="2" />`
    })
    .join('')
  const trend = linearTrend(values).map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`)
  const dots = values.map((value, index) => `<circle class="ts-type-chart__dot" cx="${x(index).toFixed(1)}" cy="${y(value).toFixed(1)}" r="2.4" />`).join('')

  return (
    `<svg class="ts-type-chart" viewBox="0 0 ${width} ${height}" role="img" ` +
    `aria-label="Words per minute across ${samples.length} seconds">` +
    `<path class="ts-type-chart__area" d="${area}" />${bars}` +
    `<polyline class="ts-type-chart__trend" points="${trend.join(' ')}" />` +
    `<polyline class="ts-type-chart__line" points="${points.join(' ')}" />${dots}</svg>`
  )
}

const tool: Tool = {
  slug: 'typing-speed-test',
  name: 'Typing Speed Test',
  description: 'A monkeytype-style test: pick time or words, punctuation and numbers, then read your WPM, accuracy and consistency over a live chart.',
  category: 'Numbers',
  keywords: ['typing', 'wpm', 'speed', 'keyboard', 'monkeytype', 'words per minute', 'accuracy', 'practice', 'test', 'consistency'],
  render(root) {
    let mode: Mode = 'time'
    let duration: Duration = 30
    let wordCount = 25
    let punctuation = false
    let numbers = false
    let quoteMode = false
    let stopOnError = false

    const settings = el('div', { class: 'ts-type-settings' })
    const timerLabel = el('div', { class: 'ts-type-timer' }, '')
    const hint = el('div', { class: 'ts-type-hint' }, 'Start typing — the timer begins on your first key')

    const track = el('div', { class: 'ts-type-track' })
    const clip = el('div', { class: 'ts-type-clip' }, track)
    const caret = el('span', { class: 'ts-type-caret' })
    const stage = el('div', { class: 'ts-type-stage' }, clip, hint)

    const hidden = el('input', {
      class: 'ts-type-input',
      type: 'text',
      autocomplete: 'off',
      autocapitalize: 'off',
      autocorrect: 'off',
      spellcheck: false,
      'aria-label': 'Type the displayed text',
    }) as HTMLInputElement

    const liveWpm = el('span', { class: 'ts-k-stat__value ts-k-mono' }, '0')
    const liveAcc = el('span', { class: 'ts-k-stat__value ts-k-mono' }, '100%')
    const liveBar = stats(
      el('div', { class: 'ts-k-stat' }, liveWpm, el('span', { class: 'ts-k-stat__label' }, 'WPM')),
      el('div', { class: 'ts-k-stat' }, liveAcc, el('span', { class: 'ts-k-stat__label' }, 'Accuracy')),
    )

    const results = el('div', { class: 'ts-type-results', 'aria-live': 'polite' })
    results.hidden = true

    let target = ''
    let words: string[] = []
    let charSpans: HTMLElement[] = []
    let events: KeyEvent[] = []
    let typed = ''
    let locked = false
    let startedAt = 0
    let running = false
    let finished = false
    let raf = 0
    let lineHeight = 0

    /* -- text generation ---------------------------------------------------- */

    function makeWords(count: number): string[] {
      const base = shuffled(BANK)
      const out: string[] = []
      for (let i = 0; i < count; i += 1) {
        let word = base[i % base.length]
        if (out[out.length - 1] === word && base.length > 1) word = base[(i + 1) % base.length]
        if (punctuation) {
          if (i > 0 && i % 7 === 0) word += PUNCTUATION[i % PUNCTUATION.length]
          else if (i > 0 && i % 11 === 0) word = word[0].toUpperCase() + word.slice(1)
        }
        out.push(word)
        if (numbers && i > 0 && i % 13 === 0) out.push(String(randomInt(100)))
      }
      return out
    }

    function generate() {
      if (quoteMode) words = [shuffled(QUOTES)[0]]
      else if (mode === 'words') words = makeWords(wordCount)
      else words = makeWords(duration >= 60 ? 150 : 85)
      target = words.join(' ')
      if (!punctuation && !quoteMode) target = target.toLowerCase()
    }

    function extend() {
      words = words.concat(makeWords(mode === 'time' && duration >= 60 ? 90 : 60))
      target = words.join(' ')
      if (!punctuation && !quoteMode) target = target.toLowerCase()
      buildSpans()
    }

    /* -- rendering ---------------------------------------------------------- */

    function charState(index: number): string {
      if (index < typed.length) return typed[index] === target[index] ? 'ok' : 'bad'
      if (index === typed.length) return locked ? 'bad' : 'current'
      return 'rest'
    }

    function paint(index: number) {
      const span = charSpans[index]
      if (span) span.className = `ts-type-char is-${charState(index)}`
    }

    function measure() {
      const first = charSpans[0]
      if (!first) return
      const computed = parseFloat(getComputedStyle(track).lineHeight)
      if (!lineHeight) lineHeight = Number.isFinite(computed) && computed > 0 ? computed : first.offsetHeight * 1.65
      clip.style.height = `${lineHeight * VISIBLE_LINES}px`
    }

    function buildSpans() {
      charSpans = characters(target).map((char) => el('span', { class: 'ts-type-char is-rest' }, char === ' ' ? '\u00a0' : char))
      track.replaceChildren(...charSpans, caret)
      paint(typed.length)
      measure()
      positionCaret()
    }

    function positionCaret() {
      const current = charSpans[Math.min(typed.length, charSpans.length - 1)]
      if (!current) {
        caret.style.display = 'none'
        return
      }
      caret.style.display = ''
      const atEnd = typed.length >= charSpans.length
      caret.style.left = `${current.offsetLeft + (atEnd ? current.offsetWidth : 0)}px`
      caret.style.top = `${current.offsetTop}px`
      caret.style.height = `${current.offsetHeight}px`

      const lineOf = lineHeight ? Math.floor(current.offsetTop / lineHeight) : 0
      const totalLines = lineHeight ? Math.ceil(track.scrollHeight / lineHeight) : VISIBLE_LINES
      const scroll = Math.min(Math.max(0, totalLines - VISIBLE_LINES), Math.max(0, lineOf - 1))
      track.style.transform = `translateY(${-scroll * lineHeight}px)`
    }

    /* -- settings ----------------------------------------------------------- */

    function chipGroup(label: string, options: Array<{ label: string; active: () => boolean; pick: () => void }>): HTMLElement {
      const group = el('div', { class: 'ts-type-group' }, el('span', { class: 'ts-type-group__label' }, label))
      for (const option of options) {
        group.append(
          el('button', {
            class: `ts-type-chip${option.active() ? ' is-active' : ''}`,
            type: 'button',
            'aria-pressed': option.active() ? 'true' : 'false',
            onclick: () => {
              option.pick()
              renderSettings()
              reset()
              hidden.focus()
            },
          }, option.label),
        )
      }
      return group
    }

    function renderSettings() {
      settings.replaceChildren(
        chipGroup('Mode', [
          { label: 'time', active: () => mode === 'time', pick: () => (mode = 'time') },
          { label: 'words', active: () => mode === 'words', pick: () => (mode = 'words') },
        ]),
        mode === 'time'
          ? chipGroup('Duration', [15, 30, 60, 120].map((d) => ({ label: `${d}s`, active: () => duration === d, pick: () => (duration = d as Duration) })))
          : chipGroup('Words', [10, 25, 50, 100].map((n) => ({ label: String(n), active: () => wordCount === n, pick: () => (wordCount = n) }))),
        chipGroup('Include', [
          { label: 'punctuation', active: () => punctuation, pick: () => (punctuation = !punctuation) },
          { label: 'numbers', active: () => numbers, pick: () => (numbers = !numbers) },
          { label: 'quotes', active: () => quoteMode, pick: () => (quoteMode = !quoteMode) },
          { label: 'stop on error', active: () => stopOnError, pick: () => (stopOnError = !stopOnError) },
        ]),
      )
    }

    /* -- run control -------------------------------------------------------- */

    function reset() {
      cancelAnimationFrame(raf)
      running = false
      finished = false
      locked = false
      events = []
      typed = ''
      lineHeight = 0
      clip.style.height = ''
      hidden.value = ''
      results.hidden = true
      hint.hidden = false
      generate()
      buildSpans()
      track.style.transform = 'translateY(0)'
      liveWpm.textContent = '0'
      liveAcc.textContent = '100%'
      timerLabel.textContent = mode === 'time' ? `${duration}s` : `${wordCount} words`
      stage.classList.remove('is-started')
    }

    function begin() {
      running = true
      startedAt = performance.now()
      hint.hidden = true
      stage.classList.add('is-started')
      raf = requestAnimationFrame(tick)
    }

    function finish() {
      if (finished) return
      finished = true
      running = false
      cancelAnimationFrame(raf)
      const elapsed = startedAt ? performance.now() - startedAt : 0
      let standing = 0
      for (let i = 0; i < typed.length; i += 1) if (typed[i] === target[i]) standing += 1
      const summary = keystrokeStats(events, standing, elapsed)
      const gaps: number[] = []
      for (let i = 1; i < events.length; i += 1) gaps.push(events[i].at - events[i - 1].at)
      const consistency = consistencyFrom(gaps)
      const series = perSecondSeries(events, elapsed)
      const weak = weakKeys(events)

      const previousBest = readBest()
      const isBest = summary.wpm > previousBest
      if (isBest) writeBest(summary.wpm)

      results.replaceChildren(
        el('div', { class: 'ts-type-summary' },
          el('div', { class: 'ts-type-summary__wpm' },
            el('span', { class: 'ts-type-summary__value ts-k-mono' }, summary.wpm.toFixed(0)),
            el('span', { class: 'ts-type-summary__unit' }, 'WPM'),
            isBest ? el('span', { class: 'ts-type-pb' }, previousBest > 0 ? 'Personal best' : 'First run logged') : null,
          ),
          stats(
            stat({ label: 'Accuracy', value: `${summary.accuracy.toFixed(1)}%` }),
            stat({ label: 'Raw WPM', value: summary.rawWpm.toFixed(0), hint: 'Every correct keypress' }),
            stat({ label: 'Consistency', value: `${consistency.score}%` }),
            stat({ label: 'Characters', value: `${summary.correct} ✓  ${summary.incorrect} ✗` }),
            stat({ label: 'Corrections', value: String(summary.backspaces) }),
          ),
        ),
        ...(series.length >= 2
          ? [card('Speed over time', el('div', { class: 'ts-type-chart-wrap', innerHTML: chartSvg(series) }))]
          : []),
        ...(weak.length
          ? [card('Keys to practise', el('div', { class: 'ts-type-weak' },
              ...weak.map((entry) => el('span', { class: 'ts-type-weak__key' },
                el('b', {}, entry.char),
                el('span', {}, `${Math.round(entry.rate * 100)}% off`),
              )),
            ))]
          : []),
      )
      results.hidden = false
      timerLabel.textContent = 'Done — type or press Tab to go again'
    }

    /** A small titled block used inside the results. */
    function card(title: string, body: HTMLElement): HTMLElement {
      return el('div', { class: 'ts-type-card' }, el('div', { class: 'ts-type-card__title' }, title), body)
    }

    function tick() {
      if (!running) return
      const elapsed = performance.now() - startedAt
      const live = keystrokeStats(events, typed.length, elapsed)
      liveWpm.textContent = live.rawWpm.toFixed(0)
      liveAcc.textContent = `${live.accuracy.toFixed(0)}%`

      if (mode === 'time') {
        const left = Math.max(0, duration * 1000 - elapsed)
        timerLabel.textContent = `${(left / 1000).toFixed(1)}s`
        if (left <= 0) {
          finish()
          return
        }
      } else {
        const done = typed.split(' ').length - 1
        timerLabel.textContent = `${Math.min(done, wordCount)} / ${wordCount} words`
      }
      raf = requestAnimationFrame(tick)
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Tab') {
        event.preventDefault()
        reset()
        hidden.focus()
        return
      }
      if (event.key === 'Escape') {
        hidden.blur()
        return
      }
      if (finished) {
        if (event.key.length === 1 || event.key === 'Backspace') {
          event.preventDefault()
          reset()
          hidden.focus()
        }
        return
      }
      if (!running) begin()

      if (event.key === 'Backspace') {
        event.preventDefault()
        if (locked) {
          locked = false
          paint(typed.length)
          positionCaret()
          return
        }
        if (typed.length > 0) {
          const removed = typed.length - 1
          typed = typed.slice(0, -1)
          events.push({ char: null, correct: true, at: performance.now() - startedAt })
          paint(removed)
          paint(typed.length)
          positionCaret()
        }
        return
      }

      if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return
      event.preventDefault()

      if (typed.length >= target.length) {
        if (mode === 'time') {
          extend()
        } else {
          finish()
          return
        }
      }

      const expected = target[typed.length]
      if (expected === undefined) {
        finish()
        return
      }

      const correct = event.key === expected
      events.push({ char: event.key, correct, at: performance.now() - startedAt, expected })

      if (!correct && stopOnError) {
        locked = true
        paint(typed.length)
        positionCaret()
        return
      }

      typed += event.key
      paint(typed.length - 1)
      paint(typed.length)
      positionCaret()

      if (typed.length >= target.length && mode === 'words') finish()
    }

    hidden.addEventListener('keydown', onKey)
    stage.addEventListener('click', () => hidden.focus())

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Test', icon: 'type', meta: 'Tab to restart', flush: true },
          settings,
          timerLabel,
          stage,
          hidden,
          liveBar,
          el('div', { class: 'ts-k-actions' }, button('Restart', { icon: 'refresh', onClick: () => { reset(); hidden.focus() } })),
        ),
        results,
        section(
          'How it is measured',
          note(
            'A "word" is five characters, the convention that makes prose and code comparable. WPM counts only the characters still standing, so a correction costs time but not a character; raw WPM counts every correct keypress and is the flattering number. Accuracy is correct keypresses over all keypresses, so backspacing cannot erase a mistake from the score. Consistency reads how evenly your inter-key gaps fell.',
          ),
        ),
      ),
    )

    renderSettings()
    reset()
    setTimeout(() => hidden.focus(), 0)
  },
}

export default tool
