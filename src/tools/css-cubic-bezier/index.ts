import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { createEasing, evaluate, parseBezier, PRESETS, presetNames, sampleCurve, summarise, toCss, type Bezier } from './bezier'

function numberInput(value: number) {
  return el('input', { class: 'ts-input ts-mono', type: 'number', step: '0.01', value: String(value) }) as HTMLInputElement
}

const tool: Tool = {
  slug: 'css-cubic-bezier',
  name: 'Cubic Bézier Editor',
  description: 'Tune a CSS easing curve, preview it and copy the cubic-bezier value.',
  category: 'Design',
  keywords: ['css', 'bezier', 'easing', 'timing function', 'animation', 'transition', 'cubic-bezier'],
  render(root) {
    const x1 = numberInput(0.42)
    const y1 = numberInput(0)
    const x2 = numberInput(0.58)
    const y2 = numberInput(1)
    const duration = el('input', { class: 'ts-input ts-mono', type: 'number', min: '100', max: '5000', step: '100', value: '900' }) as HTMLInputElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const curve = el('div', { class: 'ts-bezier-curve' })
    const cssOut = el('code', { class: 'ts-bezier-css' })
    const details = el('div', { class: 'ts-copy-list' })
    const ball = el('span', { class: 'ts-bezier-ball' })
    const track = el('div', { class: 'ts-bezier-track' }, ball)
    let current: Bezier = { x1: 0.42, y1: 0, x2: 0.58, y2: 1 }
    let easing = createEasing(current)
    let frame = 0
    let running = false

    function draw() {
      const points = sampleCurve(current, 60)
      const toPath = (x: number, y: number) => `${(x * 100).toFixed(2)},${(100 - y * 100).toFixed(2)}`
      const path = points.map((point) => toPath(point.x, point.y)).join(' ')
      const summary = summarise(current)
      curve.innerHTML = `
        <svg viewBox="-8 -42 116 148" preserveAspectRatio="xMidYMid meet" class="ts-bezier-svg">
          <line x1="0" y1="100" x2="100" y2="100" class="ts-bezier-axis" />
          <line x1="0" y1="0" x2="100" y2="0" class="ts-bezier-axis" />
          <line x1="0" y1="100" x2="${current.x1 * 100}" y2="${100 - current.y1 * 100}" class="ts-bezier-handle" />
          <line x1="100" y1="0" x2="${current.x2 * 100}" y2="${100 - current.y2 * 100}" class="ts-bezier-handle" />
          <polyline points="${path}" class="ts-bezier-line" />
          <circle cx="${current.x1 * 100}" cy="${100 - current.y1 * 100}" r="3" class="ts-bezier-point" />
          <circle cx="${current.x2 * 100}" cy="${100 - current.y2 * 100}" r="3" class="ts-bezier-point" />
          <circle cx="0" cy="100" r="2.5" class="ts-bezier-anchor" />
          <circle cx="100" cy="0" r="2.5" class="ts-bezier-anchor" />
        </svg>`
      cssOut.textContent = toCss(current)

      details.replaceChildren()
      const rows: [string, string][] = [
        ['At 25%', evaluate(current, 0.25).toFixed(4)],
        ['At 50%', evaluate(current, 0.5).toFixed(4)],
        ['At 75%', evaluate(current, 0.75).toFixed(4)],
        ['Overshoots', summary.overshoot ? 'Yes' : 'No'],
        ['Fastest at', `${Math.round(summary.fastestAt * 100)}%`],
      ]
      for (const [label, value] of rows) details.append(el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted ts-bezier-name' }, label), el('code', { class: 'ts-bezier-value' }, value), copyChip(value, 'Copy')))
    }

    function run() {
      try {
        current = parseBezier(`${x1.value}, ${y1.value}, ${x2.value}, ${y2.value}`)
        easing = createEasing(current)
        error.hidden = true
        draw()
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not read those numbers.'
        error.hidden = false
      }
    }

    function stop() {
      running = false
      cancelAnimationFrame(frame)
    }

    function play() {
      stop()
      running = true
      const start = performance.now()
      const ms = Math.max(100, Number(duration.value) || 900)
      const step = (now: number) => {
        if (!running) return
        const progress = Math.min(1, (now - start) / ms)
        ball.style.left = `${easing(progress) * 100}%`
        if (progress < 1) frame = requestAnimationFrame(step)
        else {
          running = false
          ball.style.left = '0%'
        }
      }
      ball.style.left = '0%'
      frame = requestAnimationFrame(step)
    }

    for (const node of [x1, y1, x2, y2]) node.addEventListener('input', run)

    const presetRow = el(
      'div',
      { class: 'ts-row ts-wrap' },
      ...presetNames().map((name) =>
        el('button', { class: 'ts-chip', type: 'button', onclick: () => { const preset = PRESETS[name]; x1.value = String(preset.x1); y1.value = String(preset.y1); x2.value = String(preset.x2); y2.value = String(preset.y2); run(); play() } }, name),
      ),
    )

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'x1'), x1),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'y1'), y1),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'x2'), x2),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'y2'), y2),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Duration (ms)'), duration),
        ),
        error,
        el('div', { class: 'ts-row ts-between' }, cssOut, copyChip(() => cssOut.textContent ?? '', 'Copy CSS')),
        curve,
        el('div', { class: 'ts-row ts-wrap' }, el('button', { class: 'ts-button', type: 'button', onclick: play }, 'Play'), el('button', { class: 'ts-button', type: 'button', onclick: () => { stop(); ball.style.left = '0%' } }, 'Reset')),
        track,
        details,
        el('h3', { class: 'ts-subhead' }, 'Presets'),
        presetRow,
        el('p', { class: 'ts-note' }, 'x1 and x2 stay between 0 and 1 as CSS requires; y1 and y2 may go outside that range, which is what produces overshoot and anticipation.'),
      ),
    )

    run()
    play()
  },
}

export default tool
