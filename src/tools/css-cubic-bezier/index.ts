import {
  actions,
  button,
  chips,
  copyRow,
  field,
  grid,
  kvList,
  note,
  outputBlock,
  panel,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { createEasing, evaluate, parseBezier, PRESETS, presetNames, sampleCurve, summarise, toCss, type Bezier } from './bezier'

const tool: Tool = {
  slug: 'css-cubic-bezier',
  name: 'Cubic Bézier Editor',
  description: 'Tune a CSS easing curve, preview it and copy the cubic-bezier value.',
  category: 'Design',
  keywords: ['css', 'bezier', 'easing', 'timing function', 'animation', 'transition', 'cubic-bezier'],
  render(root) {
    const coords = {
      x1: textField({ type: 'number', value: '0.42', mono: true, onInput: () => run() }),
      y1: textField({ type: 'number', value: '0', mono: true, onInput: () => run() }),
      x2: textField({ type: 'number', value: '0.58', mono: true, onInput: () => run() }),
      y2: textField({ type: 'number', value: '1', mono: true, onInput: () => run() }),
    }
    const duration = textField({ type: 'number', value: '900', mono: true })
    const error = note('', 'danger')
    error.hidden = true
    const curve = el('div', { class: 'ts-bezier-curve' })
    const details = kvList()
    const ball = el('span', { class: 'ts-bezier-ball' })
    const track = el('div', { class: 'ts-bezier-track' }, ball)
    let css = ''
    const cssOut = outputBlock('', { label: 'CSS', copy: () => css })
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
        <svg viewBox="-8 -42 116 148" preserveAspectRatio="xMidYMid meet" class="ts-bezier-svg" aria-hidden="true">
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
      css = toCss(current)
      cssOut.body.replaceChildren(css)
      cssOut.setMeta('')

      const rows: [string, string][] = [
        ['At 25%', evaluate(current, 0.25).toFixed(4)],
        ['At 50%', evaluate(current, 0.5).toFixed(4)],
        ['At 75%', evaluate(current, 0.75).toFixed(4)],
        ['Overshoots', summary.overshoot ? 'Yes' : 'No'],
        ['Fastest at', `${Math.round(summary.fastestAt * 100)}%`],
      ]
      details.replaceChildren(...rows.map(([label, value]) => copyRow(label, value)))
    }

    function run() {
      try {
        current = parseBezier(`${coords.x1.value}, ${coords.y1.value}, ${coords.x2.value}, ${coords.y2.value}`)
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

    const presetRow = chips(
      presetNames().map((name) => ({
        label: name,
        onClick: () => {
          const preset = PRESETS[name]
          coords.x1.value = String(preset.x1)
          coords.y1.value = String(preset.y1)
          coords.x2.value = String(preset.x2)
          coords.y2.value = String(preset.y2)
          run()
          play()
        },
      })),
    )

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Control points', icon: 'sliders' },
          grid(110,
            field(coords.x1, { label: 'x1' }),
            field(coords.y1, { label: 'y1' }),
            field(coords.x2, { label: 'x2' }),
            field(coords.y2, { label: 'y2' }),
          ),
          field(duration, { label: 'Duration (ms)' }),
          error,
        ),
        cssOut,
        panel(
          { title: 'Preview', icon: 'play' },
          curve,
          actions(
            button('Play', { variant: 'primary', icon: 'play', onClick: play }),
            button('Reset', { icon: 'refresh', onClick: () => { stop(); ball.style.left = '0%' } }),
          ),
          track,
        ),
        panel({ title: 'Curve details', icon: 'chart' }, details),
        panel({ title: 'Presets', icon: 'wand' }, presetRow),
        note('x1 and x2 stay between 0 and 1 as CSS requires; y1 and y2 may go outside that range, which is what produces overshoot and anticipation.'),
      ),
    )

    run()
    play()
  },
}

export default tool
