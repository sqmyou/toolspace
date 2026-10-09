import {
  badge,
  copyRow,
  field,
  kvList,
  note,
  panel,
  slider,
  textField,
  toolLayout,
} from '../../core/components'
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

const tool: Tool = {
  slug: 'color-converter',
  name: 'Color Converter & Contrast',
  description: 'Convert between HEX, RGB and HSL, and check WCAG contrast for text.',
  category: 'Design',
  keywords: ['color', 'colour', 'hex', 'rgb', 'hsl', 'contrast', 'wcag', 'a11y', 'accessibility'],
  render(root) {
    const input = textField({ value: DEFAULT, mono: true, onInput: () => update() })
    const bgInput = textField({ value: DEFAULT_BG, mono: true, onInput: () => update() })
    const swatch = el('div', { class: 'ts-swatch' })
    const error = note('', 'danger')
    error.hidden = true
    const rows = kvList()
    const ratio = badge('—')
    const sample = el('div', { class: 'ts-contrast-sample' }, 'Sample text at 16px')
    const checks = el('div', { class: 'ts-checks' })

    const channels: { key: keyof Rgb; read: () => string; set: (value: number) => void }[] = []
    const sliders = el(
      'div',
      { class: 'ts-sliders' },
      ...(['r', 'g', 'b'] as (keyof Rgb)[]).map((key) => {
        const control = slider({
          label: key.toUpperCase(),
          min: 0,
          max: 255,
          value: 0,
          onInput: () => {
            const rgb: Rgb = {
              r: Number(channels[0].read()),
              g: Number(channels[1].read()),
              b: Number(channels[2].read()),
            }
            input.value = toHex(rgb)
            update()
          },
        })
        const range = control.querySelector('input') as HTMLInputElement
        const readout = control.querySelector('.ts-k-slider__value') as HTMLElement
        channels.push({
          key,
          read: () => range.value,
          set: (value: number) => {
            range.value = String(value)
            readout.textContent = String(value)
          },
        })
        return control
      }),
    )

    function syncSliders(rgb: Rgb) {
      for (const channel of channels) channel.set(rgb[channel.key])
    }

    function check(label: string, ok: boolean) {
      return el(
        'div',
        { class: 'ts-check-line' },
        el('span', { class: ok ? 'ts-pass-dot' : 'ts-fail-dot' }, ok ? '✓' : '✕'),
        el('span', {}, label),
      )
    }

    function renderContrast(fg: Rgb, bg: Rgb) {
      const result: ContrastResult = evaluateContrast(fg, bg)
      const value = result.ratio.toFixed(2)
      ratio.textContent = `${value}:1`
      ratio.className = `ts-k-badge is-${result.aaNormal ? 'ok' : result.aaLarge ? 'warn' : 'danger'}`
      sample.style.color = toHex(fg)
      sample.style.background = toHex(bg)

      checks.replaceChildren(
        check('AA · normal text (4.5:1)', result.aaNormal),
        check('AA · large text (3:1)', result.aaLarge),
        check('AAA · normal text (7:1)', result.aaaNormal),
        check('AAA · large text (4.5:1)', result.aaaLarge),
      )
    }

    function update() {
      const rgb = parseColor(input.value)
      const bgRgb = parseColor(bgInput.value) ?? { r: 14, g: 17, b: 22 }

      if (!rgb) {
        swatch.style.background = 'transparent'
        rows.replaceChildren()
        error.textContent = 'Not a colour. Try #4f8cff, rgb(79,140,255) or #f80.'
        error.hidden = false
        return
      }

      error.hidden = true
      const hsl = rgbToHsl(rgb)
      swatch.style.background = toHex(rgb)
      syncSliders(rgb)
      rows.replaceChildren(
        copyRow('HEX', toHex(rgb)),
        copyRow('RGB', formatRgb(rgb)),
        copyRow('HSL', formatHsl(hsl)),
      )
      renderContrast(rgb, bgRgb)
    }

    root.append(
      toolLayout(
        {},
        panel(
          { title: 'Colour', icon: 'palette' },
          el('div', { class: 'ts-color-top' }, swatch, el('div', { class: 'ts-grow' }, field(input, { label: 'Color' }))),
          error,
        ),
        panel({ title: 'Channels', icon: 'sliders' }, field(sliders, { label: 'RGB channels' })),
        panel({ title: 'Formats', icon: 'code' }, rows),
        panel(
          { title: 'Contrast check', icon: 'eye' },
          field(bgInput, { label: 'Background' }),
          el('div', { class: 'ts-k-actions' }, el('span', { class: 'ts-k-hint' }, 'Contrast ratio'), ratio),
          sample,
          checks,
        ),
        note('All conversion and contrast maths runs locally. Nothing is sent anywhere.'),
      ),
    )

    update()
  },
}

export default tool
