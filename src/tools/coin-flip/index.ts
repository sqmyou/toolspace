import { el } from '../../core/dom'
import { panel, toolLayout } from '../../core/components'
import type { Tool } from '../../core/types'
import { flip, flipMany, longestStreak, tally, type Side } from './coin'

const MAX_BATCH = 10000

/** A 16-bit draw from the platform CSPRNG — real entropy, no Math.random. */
function source(): number {
  const buf = new Uint16Array(1)
  crypto.getRandomValues(buf)
  return buf[0]
}

const tool: Tool = {
  slug: 'coin-flip',
  name: 'Coin Flip',
  description: 'Flip a fair coin, a batch at a time, and watch the totals and the longest streak build.',
  category: 'Numbers',
  keywords: ['coin', 'flip', 'heads', 'tails', 'random', 'decision', 'toss', 'chance'],
  render(root) {
    const face = el('div', { class: 'ts-flip-face', 'aria-hidden': 'true' }, 'H')
    const stage = el('div', { class: 'ts-flip-stage' }, face)
    const result = el('p', { class: 'ts-flip-result', role: 'status', 'aria-live': 'polite' }, 'Press flip to toss a coin.')

    const headsValue = el('span', { class: 'ts-k-stat__value ts-k-mono' }, '0')
    const tailsValue = el('span', { class: 'ts-k-stat__value ts-k-mono' }, '0')
    const streakValue = el('span', { class: 'ts-k-stat__value ts-k-mono' }, '—')
    const recent = el('div', { class: 'ts-flip-recent', 'aria-hidden': 'true' })

    const history: Side[] = []

    function setFace(side: Side) {
      face.textContent = side === 'heads' ? 'H' : 'T'
      face.dataset.side = side
      stage.dataset.side = side
      result.textContent = side === 'heads' ? 'Heads' : 'Tails'
    }

    function refresh() {
      const counts = tally(history)
      headsValue.textContent = String(counts.heads)
      tailsValue.textContent = String(counts.tails)
      const streak = longestStreak(history)
      streakValue.textContent = streak.length === 0 ? '—' : `${streak.length} · ${streak.side}`
      recent.replaceChildren(...history.slice(-28).map((side) => el('span', { class: `ts-flip-dot is-${side}` })))
    }

    function spin() {
      stage.classList.remove('is-spinning')
      void (stage as HTMLElement).offsetWidth // restart the keyframe on a repeat flip
      stage.classList.add('is-spinning')
    }

    function toss() {
      const side = flip(source)
      history.push(side)
      spin()
      setFace(side)
      refresh()
    }

    const flipBtn = el('button', { class: 'ts-flip-btn', type: 'button' }, 'Flip') as HTMLButtonElement
    flipBtn.setAttribute('aria-label', 'Flip the coin')
    flipBtn.addEventListener('click', toss)

    const batchSize = el('input', {
      class: 'ts-flip-batch',
      type: 'number',
      min: '1',
      max: String(MAX_BATCH),
      step: '1',
      value: '100',
      'aria-label': 'Number of flips in a batch',
    }) as HTMLInputElement

    const batchBtn = el('button', { class: 'ts-flip-btn ts-flip-btn--ghost', type: 'button' }, 'Flip 100') as HTMLButtonElement
    batchBtn.setAttribute('aria-label', 'Run a batch of coin flips')
    batchBtn.addEventListener('click', () => {
      const count = Math.max(1, Math.min(MAX_BATCH, Math.floor(Number(batchSize.value) || 1)))
      batchSize.value = String(count)
      history.push(...flipMany(count, source))
      setFace(history[history.length - 1])
      refresh()
      result.textContent = `Last ${count} added · ${tally(history).total} flips so far`
    })

    const reset = el('button', { class: 'ts-flip-reset', type: 'button' }, 'Reset') as HTMLButtonElement
    reset.addEventListener('click', () => {
      history.length = 0
      setFace('heads')
      refresh()
      result.textContent = 'Press flip to toss a coin.'
    })

    root.append(
      toolLayout(
        {},
        panel(
          { title: 'Toss', icon: 'refresh' },
          el(
            'div',
            { class: 'ts-flip' },
            el(
              'p',
              { class: 'ts-flip-hint' },
              'Click Flip, or focus the button and press ',
              el('kbd', { class: 'ts-flip-key' }, 'Space'),
              '.',
            ),
            stage,
            result,
            el('div', { class: 'ts-flip-actions' }, flipBtn, el('div', { class: 'ts-flip-batchwrap' }, batchSize, batchBtn), reset),
          ),
        ),
        panel(
          { title: 'Totals' },
          el(
            'div',
            { class: 'ts-k-stats' },
            el('div', { class: 'ts-k-stat' }, headsValue, el('span', { class: 'ts-k-stat__label' }, 'Heads')),
            el('div', { class: 'ts-k-stat' }, tailsValue, el('span', { class: 'ts-k-stat__label' }, 'Tails')),
            el('div', { class: 'ts-k-stat' }, streakValue, el('span', { class: 'ts-k-stat__label' }, 'Longest streak')),
          ),
          recent,
        ),
      ),
    )

    refresh()
  },
}

export default tool
