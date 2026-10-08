import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
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
    const picker = el('input', { class: 'ts-input', type: 'color', value: '#3b82f6', 'aria-label': 'Base colour' }) as HTMLInputElement
    const hexInput = el('input', { class: 'ts-input ts-mono', type: 'text', value: '#3b82f6', spellcheck: false, 'aria-label': 'Base hex' }) as HTMLInputElement
    const nameInput = el('input', { class: 'ts-input', type: 'text', value: 'brand', spellcheck: false, 'aria-label': 'Variable prefix' }) as HTMLInputElement

    const swatches = el('div', { class: 'ts-swatch-grid' })
    const harmoniesRow = el('div', { class: 'ts-harmony-row' })
    const info = el('p', { class: 'ts-muted' })
    const cssBlock = el('pre', { class: 'ts-css-out' })
    const error = el('p', { class: 'ts-error', hidden: true })
    let css = ''

    function render7(rgb: Rgb) {
      swatches.replaceChildren()
      const shades = generateShades(rgb)
      for (const swatch of shades) {
        const cell = el('div', { class: 'ts-swatch' })
        const chip = el('button', { class: 'ts-swatch-chip', type: 'button', title: `Copy ${swatch.hex}` })
        chip.style.background = swatch.hex
        chip.style.color = swatch.ink
        chip.append(el('span', { class: 'ts-swatch-step' }, `${swatch.step}`))
        chip.addEventListener('click', () => navigator.clipboard?.writeText(swatch.hex))
        cell.append(chip, el('code', { class: 'ts-swatch-hex' }, swatch.hex), el('span', { class: 'ts-swatch-ratio' }, `${swatch.ratioWithInk}:1`))
        swatches.append(cell)
      }

      harmoniesRow.replaceChildren()
      for (const harmony of harmonies(rgb)) {
        const item = el('div', { class: 'ts-harmony' })
        const dot = el('span', { class: 'ts-harmony-dot' })
        dot.style.background = harmony.hex
        item.append(dot, el('span', {}, harmony.name), el('code', { class: 'ts-mono-sm' }, harmony.hex))
        harmoniesRow.append(item)
      }

      css = toCssVariables(shades, nameInput.value)
      cssBlock.textContent = css
    }

    function update(base: string, fromPicker: boolean) {
      try {
        const rgb = parseHex(base)
        error.hidden = true
        if (!fromPicker) picker.value = toHex(rgb)
        hexInput.value = toHex(rgb)
        const hsl = rgbToHsl(rgb)
        info.textContent = `hsl(${round(hsl.h)}, ${round(hsl.s)}%, ${round(hsl.l)}%) · white ${contrastRatio(rgb, { r: 255, g: 255, b: 255 }).toFixed(2)}:1 · black ${contrastRatio(rgb, { r: 0, g: 0, b: 0 }).toFixed(2)}:1`
        render7(rgb)
      } catch (err) {
        error.textContent = err instanceof ColorError ? err.message : 'Enter a hex colour like #3b82f6.'
        error.hidden = false
      }
    }

    picker.addEventListener('input', () => update(picker.value, true))
    hexInput.addEventListener('input', () => update(hexInput.value, false))
    nameInput.addEventListener('input', () => update(hexInput.value, false))

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Base colour'), picker),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Hex'), hexInput),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'CSS prefix'), nameInput),
        ),
        error,
        info,
        swatches,
        el('h3', { class: 'ts-subhead' }, 'Harmonies'),
        harmoniesRow,
        el(
          'div',
          { class: 'ts-row ts-between' },
          el('h3', { class: 'ts-subhead' }, 'CSS variables'),
          copyChip(() => css, 'Copy CSS'),
        ),
        cssBlock,
        el('p', { class: 'ts-note' }, 'Click a swatch to copy its hex. Contrast ratios are against black and white ink, not the whole ramp.'),
      ),
    )

    update('#3b82f6', false)
  },
}

export default tool
