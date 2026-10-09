import { button, note, panel, section, stat, stats, toolLayout } from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { buildText, characters, consistencyOf, keystrokeStats, shuffled, type KeyEvent } from './typing'

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

const tool: Tool = {
  slug: 'typing-speed-test',
  name: 'Typing Speed Test',
  description: 'A monkeytype-style test: pick time or word count, punctuation and numbers, then read your WPM, accuracy and consistency.',
  category: 'Numbers',
  keywords: ['typing', 'wpm', 'speed', 'keyboard', 'monkeytype', 'words per minute', 'accuracy', 'practice', 'test'],
  render(root) {
    let mode: Mode = 'time'
    let duration: Duration = 30
    let wordCount = 25
    let punctuation = false
    let numbers = false
    let quoteMode = false

    const textBox = el('div', { class: 'ts-type-text', 'aria-hidden': 'true' })
    const caret = el('span', { class: 'ts-type-caret' })
    const stage = el('div', { class: 'ts-type-stage' }, textBox, caret)

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

    const results = el('div', { class: 'ts-type-results' })
    results.hidden = true
    const timerLabel = el('div', { class: 'ts-type-timer' }, '')

    let target = ''
    let events: KeyEvent[] = []
    let typed = ''
    let startedAt = 0
    let running = false
    let raf = 0

    const settings = el('div', { class: 'ts-type-settings' })

    function chipGroup(label: string, options: Array<{ label: string; active: () => boolean; pick: () => void }>): HTMLElement {
      const group = el('div', { class: 'ts-type-group' }, el('span', { class: 'ts-type-group__label' }, label))
      for (const option of options) {
        const node = el('button', {
          class: `ts-type-chip${option.active() ? ' is-active' : ''}`,
          type: 'button',
          'aria-pressed': option.active() ? 'true' : 'false',
          onclick: () => {
            option.pick()
            renderSettings()
            reset()
          },
        }, option.label)
        group.append(node)
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
        ]),
      )
    }

    function generate(): string {
      if (quoteMode) return shuffled(QUOTES)[0]
      let words = shuffled(BANK)
      if (punctuation) {
        words = words.map((word, index) => {
          if (index > 0 && index % 7 === 0) return `${word}${PUNCTUATION[index % PUNCTUATION.length]}`
          if (index % 11 === 0 && index > 0) return `${word[0].toUpperCase()}${word.slice(1)}`
          return word
        })
      }
      if (numbers) {
        words = words.map((word, index) => (index > 0 && index % 13 === 0 ? `${word} ${randomInt(100)}` : word))
      }
      const count = mode === 'words' ? wordCount : Math.max(wordCount, 60)
      const text = buildText(words, count)
      return punctuation || quoteMode ? text : text.toLowerCase()
    }

    function reset() {
      cancelAnimationFrame(raf)
      running = false
      events = []
      typed = ''
      target = generate()
      hidden.value = ''
      results.hidden = true
      caret.style.display = 'none'
      timerLabel.textContent = mode === 'time' ? `${duration}s` : `${wordCount} words`
      renderText()
      liveWpm.textContent = '0'
      liveAcc.textContent = '100%'
      renderSettings()
    }

    function renderText() {
      const chars = characters(target)
      const nodes = chars.map((char, index) => {
        const state = index < typed.length ? (typed[index] === char ? 'ok' : 'bad') : index === typed.length ? 'current' : 'rest'
        const display = char === ' ' ? '\u00a0' : char
        return el('span', { class: `ts-type-char is-${state}` }, display)
      })
      textBox.replaceChildren(...nodes)

      const current = textBox.children[Math.min(typed.length, nodes.length - 1)] as HTMLElement | undefined
      if (!current) {
        caret.style.display = 'none'
        return
      }
      caret.style.display = 'block'
      caret.style.transform = `translate(${current.offsetLeft + (typed.length < chars.length ? 0 : current.offsetWidth)}px, ${current.offsetTop}px)`
      caret.style.height = `${current.offsetHeight}px`
    }

    function finish() {
      running = false
      cancelAnimationFrame(raf)
      const elapsed = startedAt ? performance.now() - startedAt : 0
      const statsData = keystrokeStats(events, typed.length, elapsed)
      const gaps: number[] = []
      for (let i = 1; i < events.length; i += 1) gaps.push(events[i].at - events[i - 1].at)
      const mean = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0
      const steady = consistencyOf(gaps, mean)

      results.replaceChildren(
        stats(
          stat({ label: 'WPM', value: statsData.wpm.toFixed(0) }),
          stat({ label: 'Raw WPM', value: statsData.rawWpm.toFixed(0), hint: 'All correct keypresses' }),
          stat({ label: 'Accuracy', value: `${statsData.accuracy.toFixed(1)}%` }),
          stat({ label: 'Consistency', value: `${Math.round(steady)}%` }),
        ),
        stats(
          stat({ label: 'Correct', value: String(statsData.correct) }),
          stat({ label: 'Incorrect', value: String(statsData.incorrect) }),
          stat({ label: 'Corrections', value: String(statsData.backspaces) }),
        ),
      )
      results.hidden = false
      timerLabel.textContent = 'Done — press Tab or click here to go again'
    }

    function tick() {
      if (!running) return
      const elapsed = performance.now() - startedAt
      const correctSoFar = keystrokeStats(events, typed.length, elapsed)
      liveWpm.textContent = correctSoFar.wpm.toFixed(0)
      liveAcc.textContent = `${correctSoFar.accuracy.toFixed(0)}%`

      if (mode === 'time') {
        const left = Math.max(0, duration * 1000 - elapsed)
        timerLabel.textContent = `${(left / 1000).toFixed(1)}s`
        if (left <= 0) {
          finish()
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }

    function begin() {
      running = true
      startedAt = performance.now()
      raf = requestAnimationFrame(tick)
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Tab') {
        event.preventDefault()
        reset()
        return
      }
      if (event.key === 'Escape') {
        hidden.blur()
        return
      }

      if (!running) begin()

      if (event.key === 'Backspace') {
        event.preventDefault()
        if (typed.length > 0) {
          typed = typed.slice(0, -1)
          events.push({ char: null, correct: true, at: performance.now() - startedAt })
          renderText()
        }
        return
      }

      if (event.key.length !== 1) return
      event.preventDefault()

      const expected = target[typed.length]
      if (expected === undefined) return

      const correct = event.key === expected
      events.push({ char: event.key, correct, at: performance.now() - startedAt })
      typed += event.key
      renderText()

      if (typed.length >= target.length) finish()
    }

    hidden.addEventListener('keydown', onKey)
    stage.addEventListener('click', () => hidden.focus())
    stage.addEventListener('keydown', () => {})

    const restart = button('Restart', { icon: 'refresh', onClick: () => reset() })

    reset()

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
          el('div', { class: 'ts-k-actions' }, restart),
        ),
        results,
        section(
          'How it is measured',
          note(
            'A "word" is five characters, the convention that makes prose and code comparable. WPM counts only the characters still standing, so a correction costs time but not a character; raw WPM counts every correct keypress and is the flattering number. Accuracy is correct keypresses over all keypresses, so backspacing cannot erase a mistake from the score. Consistency is derived from how evenly your inter-key gaps fell.',
          ),
        ),
      ),
    )

    // Focus the hidden input so a typist can start without clicking.
    setTimeout(() => hidden.focus(), 0)
  },
}

export default tool
