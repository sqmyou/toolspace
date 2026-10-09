import {
  chips,
  copyRow,
  field,
  grid,
  note,
  panel,
  stat,
  stats,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { fitInside, formatRatio, heightForWidth, parseRatio, ratioValue, simplify, widthForHeight } from './aspect'

/** The ratios people actually reach for, so the picker is useful, not exhaustive. */
const COMMON: Array<{ value: string; label: string }> = [
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:2', label: '3:2' },
  { value: '1:1', label: '1:1' },
  { value: '21:9', label: '21:9' },
  { value: '2:3', label: '2:3' },
  { value: '5:4', label: '5:4' },
]

function numberInput(label: string, value: string): HTMLInputElement {
  const input = textField({ value, type: 'number', mono: true, onInput: () => {} })
  input.setAttribute('aria-label', label)
  input.min = '0'
  return input
}

const tool: Tool = {
  slug: 'aspect-ratio-calculator',
  name: 'Aspect Ratio Calculator',
  description: 'Simplify any width × height to its true ratio, solve the missing side, and check what fits in a box.',
  category: 'Design',
  keywords: ['aspect', 'ratio', '16:9', 'resize', 'dimensions', 'proportion', 'crop', 'scale'],
  render(root) {
    // --- Simplify two numbers -------------------------------------------------
    const width = numberInput('Source width', '1920')
    const height = numberInput('Source height', '1080')
    const simplifyStats = stats()
    const simplifyOut = el('div', { class: 'ts-k-kvlist' })

    // --- Solve the missing side ----------------------------------------------
    const ratioInput = textField({ value: '16:9', mono: true, onInput: () => solve() })
    ratioInput.setAttribute('aria-label', 'Ratio, for example 16:9')
    const knownWidth = numberInput('Known width', '1280')
    const solvedHeight = el('span', { class: 'ts-k-stat__value ts-k-mono' }, '—')
    const knownHeight = numberInput('Known height', '720')
    const solvedWidth = el('span', { class: 'ts-k-stat__value ts-k-mono' }, '—')

    // --- Fit inside a box -----------------------------------------------------
    const boxWidth = numberInput('Box width', '1024')
    const boxHeight = numberInput('Box height', '768')
    const fitOut = el('div', { class: 'ts-k-kvlist' })

    // --- Live shape -----------------------------------------------------------
    const shape = el('div', { class: 'ts-ar-shape' })
    const shapeCaption = el('p', { class: 'ts-ar-caption' }, '')

    let ratioPair: [number, number] = [16, 9]

    function safe<T>(compute: () => T, fallback: T): T {
      try {
        return compute()
      } catch {
        return fallback
      }
    }

    function recompute() {
      const w = Number(width.value)
      const h = Number(height.value)

      const simplified = safe(() => formatRatio(w, h), '—')
      const decimal = safe(() => ratioValue(w, h).toFixed(4), '—')
      simplifyStats.replaceChildren(
        stat({ label: 'Ratio', value: simplified }),
        stat({ label: 'Decimal', value: decimal }),
      )
      simplifyOut.replaceChildren(
        copyRow('Ratio', simplified),
        copyRow('CSS aspect-ratio', safe(() => `${formatRatio(w, h).replace(':', ' / ')}`, '—')),
      )

      // Preview the source, then the fitted result on top of it.
      ratioPair = safe(() => simplify(w, h), [16, 9])
      paintShape(ratioPair)
    }

    /** Draw a rectangle with the given ratio inside a fixed-size stage. */
    function paintShape([a, b]: [number, number]) {
      const box = 220
      const scale = Math.min(box / a, box / b)
      const pxW = Math.max(8, Math.round(a * scale))
      const pxH = Math.max(8, Math.round(b * scale))
      shape.replaceChildren(el('div', { class: 'ts-ar-rect', style: `width:${pxW}px;height:${pxH}px` }))
      shapeCaption.textContent = `${a}:${b} — ${pxW} × ${pxH} at the largest whole size in a ${box}px box`
    }

    function solve() {
      const pair = safe(() => parseRatio(ratioInput.value), [16, 9] as [number, number])
      ratioPair = pair
      solvedHeight.textContent = safe(() => String(Math.round(heightForWidth(Number(knownWidth.value), pair))), '—')
      solvedWidth.textContent = safe(() => String(Math.round(widthForHeight(Number(knownHeight.value), pair))), '—')
      paintShape(pair)
      ratioInput.value = `${pair[0]}:${pair[1]}`
    }

    function computeFit() {
      const w = Number(width.value)
      const h = Number(height.value)
      const fit = safe(() => fitInside(w, h, Number(boxWidth.value), Number(boxHeight.value)), null)
      if (!fit) {
        fitOut.replaceChildren(copyRow('Result', '—'))
        return
      }
      fitOut.replaceChildren(
        copyRow('Fitted size', `${fit.width} × ${fit.height}`),
        copyRow('Scale', `${(fit.scale * 100).toFixed(1)}%`),
        copyRow('Slack', `${fit.slack}px`),
      )
    }

    for (const input of [width, height]) input.addEventListener('input', recompute)
    for (const input of [knownWidth, knownHeight]) input.addEventListener('input', solve)
    for (const input of [boxWidth, boxHeight]) input.addEventListener('input', computeFit)

    const preset = chips(
      COMMON.map((item) => ({
        value: item.value,
        label: item.label,
        onClick: (value: string) => {
          ratioInput.value = value
          solve()
        },
      })),
      { selected: '16:9' },
    )

    root.append(
      toolLayout(
        { wide: true },
        grid(300,
          panel(
            { title: 'Simplify two numbers', icon: 'ruler', meta: 'width × height' },
            field(width, { label: 'Width' }),
            field(height, { label: 'Height' }),
            simplifyStats,
            simplifyOut,
          ),
          panel(
            { title: 'Solve the missing side', icon: 'swap', meta: 'one known side' },
            field(ratioInput, { label: 'Ratio' }),
            preset,
            field(knownWidth, { label: 'Known width' }),
            el('div', { class: 'ts-k-stats' }, el('div', { class: 'ts-k-stat' }, solvedHeight, el('span', { class: 'ts-k-stat__label' }, 'Height'))),
            field(knownHeight, { label: 'Known height' }),
            el('div', { class: 'ts-k-stats' }, el('div', { class: 'ts-k-stat' }, solvedWidth, el('span', { class: 'ts-k-stat__label' }, 'Width'))),
          ),
          panel(
            { title: 'Fit inside a box', icon: 'columns', meta: 'letterbox check' },
            field(boxWidth, { label: 'Box width' }),
            field(boxHeight, { label: 'Box height' }),
            fitOut,
          ),
          panel(
            { title: 'Shape', icon: 'image' },
            shape,
            shapeCaption,
          ),
        ),
        note(
          'The ratio is simplified with the greatest common divisor, so 1920×1080 is exactly 16:9 rather than 1.7778:1. Nothing here is uploaded — the maths runs in this tab.',
        ),
      ),
    )

    recompute()
    solve()
    computeFit()
  },
}

export default tool
