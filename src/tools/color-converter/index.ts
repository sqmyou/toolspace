import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import {
  evaluateContrast,
  formatHsl,
  formatRgb,
  parseColor,
  rgbToHsl,
  toHex,
  type ContrastResult,
  type Rgb,
} from './color'

const DEFAULT = '#4f8cff'
const DEFAULT_BG = '#0e1116'

interface RowSpec {
  label: string
  value: string
}

const tool: Tool = {
  slug: 'color-converter',
  name: 'Color Converter & Contrast',
  description: 'Convert between HEX, RGB and HSL, and check WCAG contrast for text.',
  category: 'Design',
  keywords: ['color', 'colour', 'hex', 'rgb', 'hsl', 'contrast', 'wcag', 'a11y', 'accessibility'],
  render(root) {
    const swatch = el('div', { class: 'ts-swatch' })
    const input = el('input', {
      class: 'ts-input ts-mono',
      value: DEFAULT,
      spellcheck: false,
      'aria-label': 'Color value',
    }) as HTMLInputElement

    const output = el('div', { class: 'ts-copy-list' })

    const bgInput = el('input', {
      class: 'ts-input ts-mono',
      value: DEFAULT_BG,
      spellcheck: false,
      'aria-label': 'Background color for contrast',
    }) as HTMLInputElement

    const badge = el('div', { class: 'ts-badge' })
    const sample = el('div', { class: 'ts-contrast-sample' }, 'Sample text at 16px')
    const checks = el('div', { class: 'ts-checks' })

    const channels: { key: keyof Rgb; range: HTMLInputElement; readout: HTMLElement }[] = []

    function slider(key: keyof Rgb, label: string) {
      const range = el('input', {
        class: 'ts-slider',
        type: 'range',
        min: '0',
        max: '255',
        value: '0',
        'aria-label': `${label} channel`,
      }) as HTMLInputElement
      const readout = el('span', { class: 'ts-slider-value' }, '0')
      range.addEventListener('input', () => {
        const rgb: Rgb = {
          r: Number(channels[0].range.value),
          g: Number(channels[1].range.value),
          b: Number(channels[2].range.value),
        }
        input.value = toHex(rgb)
        update()
      })
      channels.push({ key, range, readout })
      return el(
        'div',
        { class: 'ts-slider-row' },
        el('span', { class: 'ts-slider-label' }, label),
        range,
        readout,
      )
    }

    const sliders = el(
      'div',
      { class: 'ts-sliders' },
      slider('r', 'R'),
      slider('g', 'G'),
      slider('b', 'B'),
    )

    function syncSliders(rgb: Rgb) {
      for (const channel of channels) {
        const value = rgb[channel.key]
        channel.range.value = String(value)
        channel.readout.textContent = String(value)
      }
    }

    function row({ label, value }: RowSpec) {
      const copy = el('button', {
        class: 'ts-copy-chip',
        type: 'button',
        title: `Copy ${value}`,
        onclick: async () => {
          try {
            await navigator.clipboard.writeText(value)
            copy.textContent = 'Copied'
            setTimeout(() => (copy.textContent = value), 900)
          } catch {
            /* clipboard blocked; the value is still selectable */
          }
        },
      }, value)
      return el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, label), copy)
    }

    function renderContrast(fg: Rgb, bg: Rgb) {
      const result: ContrastResult = evaluateContrast(fg, bg)
      const ratio = result.ratio.toFixed(2)
      badge.textContent = `${ratio}:1`
      badge.className = 'ts-badge ' + (result.aaNormal ? 'ts-pass' : result.aaLarge ? 'ts-warn' : 'ts-fail')
      sample.style.color = toHex(fg)
      sample.style.background = toHex(bg)

      checks.replaceChildren(
        check('AA · normal text (4.5:1)', result.aaNormal),
        check('AA · large text (3:1)', result.aaLarge),
        check('AAA · normal text (7:1)', result.aaaNormal),
        check('AAA · large text (4.5:1)', result.aaaLarge),
      )
    }

    function check(label: string, ok: boolean) {
      return el(
        'div',
        { class: 'ts-check-line' },
        el('span', { class: ok ? 'ts-pass-dot' : 'ts-fail-dot' }, ok ? '✓' : '✕'),
        el('span', {}, label),
      )
    }

    function update() {
      const rgb = parseColor(input.value)
      const bgRgb = parseColor(bgInput.value) ?? { r: 14, g: 17, b: 22 }

      if (!rgb) {
        swatch.style.background = 'transparent'
        output.replaceChildren(el('p', { class: 'ts-error' }, 'Not a colour. Try #4f8cff, rgb(79,140,255) or #f80.'))
        return
      }

      const hsl = rgbToHsl(rgb)
      swatch.style.background = toHex(rgb)
      syncSliders(rgb)
      output.replaceChildren(
        row({ label: 'HEX', value: toHex(rgb) }),
        row({ label: 'RGB', value: formatRgb(rgb) }),
        row({ label: 'HSL', value: formatHsl(hsl) }),
      )
      renderContrast(rgb, bgRgb)
    }

    input.addEventListener('input', update)
    bgInput.addEventListener('input', update)

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el(
          'div',
          { class: 'ts-color-top' },
          swatch,
          el('div', { class: 'ts-field ts-grow' }, el('label', {}, 'Color'), input),
        ),
        el('div', { class: 'ts-field' }, el('label', {}, 'RGB channels'), sliders),
        output,
        el('h3', { class: 'ts-subhead' }, 'Contrast check'),
        el(
          'div',
          { class: 'ts-field' },
          el('label', {}, 'Background'),
          bgInput,
        ),
        el('div', { class: 'ts-row ts-between' }, el('span', { class: 'ts-muted' }, 'Contrast ratio'), badge),
        sample,
        checks,
        el('p', { class: 'ts-note' }, 'All conversion and contrast maths runs locally. Nothing is sent anywhere.'),
      ),
    )

    update()
  },
}

export default tool
