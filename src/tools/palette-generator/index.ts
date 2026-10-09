import {
  colorField,
  copyRow,
  field,
  kvList,
  note,
  outputBlock,
  panel,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { ColorError, contrastRatio, generateShades, harmonies, parseHex, rgbToHsl, toCssVariables, toHex, type Rgb } from './palette'

function round(value: number): number {
  return Math.round(value)
}

const tool: Tool = {
  slug: 'palette-generator',
  name: 'Color Palette Generator',
  description: 'Build a 50–950 shade ramp, harmonies and CSS variables from one colour.',
  category: 'Design',
  keywords: ['color', 'colour', 'palette', 'shades', 'tints', 'tailwind', 'css', 'contrast', 'hsl'],
  render(root) {
    let current: Rgb = parseHex('#3b82f6')
    const hex = colorField({ value: '#3b82f6', label: 'Base colour', onInput: (value) => update(value) })
    const prefix = textField({ value: 'brand', onInput: () => renderPalette() })
    const error = note('', 'danger')
    error.hidden = true
    const info = kvList()
    const swatches = el('div', { class: 'ts-swatch-grid' })
    const harmoniesRow = el('div', { class: 'ts-harmony-row' })
    let css = ''
    const cssBlock = outputBlock('', { label: 'CSS variables', copy: () => css })

    function renderPalette() {
      swatches.replaceChildren(
        ...generateShades(current).map((swatch) => {
          const chip = el('button', {
            class: 'ts-swatch-chip',
            type: 'button',
            title: `Copy ${swatch.hex}`,
            onclick: () => void navigator.clipboard?.writeText(swatch.hex),
          })
          chip.style.background = swatch.hex
          chip.style.color = swatch.ink
          chip.append(el('span', { class: 'ts-swatch-step' }, `${swatch.step}`))
          return el(
            'div',
            { class: 'ts-swatch' },
            chip,
            el('code', { class: 'ts-swatch-hex' }, swatch.hex),
            el('span', { class: 'ts-swatch-ratio' }, `${swatch.ratioWithInk}:1`),
          )
        }),
      )

      harmoniesRow.replaceChildren(
        ...harmonies(current).map((harmony) => {
          const dot = el('span', { class: 'ts-harmony-dot' })
          dot.style.background = harmony.hex
          return el('div', { class: 'ts-harmony' }, dot, el('span', {}, harmony.name), el('code', { class: 'ts-mono-sm' }, harmony.hex))
        }),
      )

      css = toCssVariables(generateShades(current), prefix.value)
      cssBlock.body.replaceChildren(css)
      cssBlock.setMeta('')
    }

    function update(base: string) {
      try {
        current = parseHex(base)
        error.hidden = true
        const hsl = rgbToHsl(current)
        info.replaceChildren(
          copyRow('Hex', toHex(current)),
          copyRow('HSL', `hsl(${round(hsl.h)}, ${round(hsl.s)}%, ${round(hsl.l)}%)`),
          copyRow('Contrast vs white', `${contrastRatio(current, { r: 255, g: 255, b: 255 }).toFixed(2)}:1`, { copy: false }),
          copyRow('Contrast vs black', `${contrastRatio(current, { r: 0, g: 0, b: 0 }).toFixed(2)}:1`, { copy: false }),
        )
        renderPalette()
      } catch (err) {
        error.textContent = err instanceof ColorError ? err.message : 'Enter a hex colour like #3b82f6.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'Base colour', icon: 'palette' }, hex.root, field(prefix, { label: 'CSS prefix' }), error),
        panel({ title: 'Base details', icon: 'info' }, info),
        panel({ title: 'Shade ramp', icon: 'layers' }, swatches),
        panel({ title: 'Harmonies', icon: 'sparkle' }, harmoniesRow),
        cssBlock,
        note('Click a swatch to copy its hex. Contrast ratios are against black and white ink, not the whole ramp.'),
      ),
    )

    update('#3b82f6')
  },
}

export default tool
