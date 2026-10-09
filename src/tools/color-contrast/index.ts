import {
  actions,
  badge,
  button,
  colorField,
  copyRow,
  kvList,
  note,
  panel,
  toolLayout,
  type Tone,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { bestTextColor, contrastRatio, parseColor, report, suggestForeground, toHex, toHslString, toRgbString, type Rgba } from './color'

const tool: Tool = {
  slug: 'color-contrast',
  name: 'Colour Contrast Checker',
  description: 'Check WCAG contrast between two colours and get a colour that passes.',
  category: 'Design',
  keywords: ['colour', 'color', 'contrast', 'wcag', 'accessibility', 'a11y', 'hex', 'hsl', 'luminance'],
  render(root) {
    let foreground = parseColor('#777777')
    let background = parseColor('#ffffff')

    const fg = colorField({ value: '#777777', label: 'Foreground', onInput: (value) => {
      foreground = parseColor(value)
      run()
    } })
    const bg = colorField({ value: '#ffffff', label: 'Background', onInput: (value) => {
      background = parseColor(value)
      run()
    } })
    const ratio = el('span', { class: 'ts-contrast-ratio ts-k-mono' })
    const verdict = el('div', { class: 'ts-k-actions' })
    const preview = el(
      'div',
      { class: 'ts-contrast-preview' },
      el('p', { class: 'ts-contrast-large' }, 'Large text 24px'),
      el('p', {}, 'Normal body text at the default size'),
      el('p', { class: 'ts-contrast-small' }, 'Small helper text'),
    )
    const rows = kvList()
    const error = note('', 'danger')
    error.hidden = true
    const suggestions = el('div', { class: 'ts-k-actions' })

    function run() {
      try {
        const result = report(foreground, background)
        ratio.textContent = `${result.ratio.toFixed(2)}:1`

        const tone = (pass: boolean): Tone => (pass ? 'ok' : 'danger')
        verdict.replaceChildren(
          badge(`AA normal ${result.normalPass ? 'pass' : 'fail'}`, tone(result.normalPass)),
          badge(`AA large ${result.largePass ? 'pass' : 'fail'}`, tone(result.largePass)),
          badge(`AAA ${result.aaaPass ? 'pass' : 'fail'}`, tone(result.aaaPass)),
        )

        preview.style.color = toHex(foreground)
        preview.style.background = toHex(background)

        rows.replaceChildren(
          copyRow('Foreground', `${toHex(foreground)} · ${toRgbString(foreground)} · ${toHslString(foreground)}`),
          copyRow('Background', `${toHex(background)} · ${toRgbString(background)} · ${toHslString(background)}`),
          copyRow('Contrast', `${result.ratio.toFixed(2)}:1`),
        )

        const choices: [string, Rgba][] = [
          ['Black', { r: 0, g: 0, b: 0, a: 1 }],
          ['White', { r: 255, g: 255, b: 255, a: 1 }],
          ['Best match', bestTextColor(background)],
          ['Nearest passing', suggestForeground(foreground, background, 4.5)],
        ]
        suggestions.replaceChildren(
          ...choices.map(([label, color]) =>
            button(`${label} ${toHex(color)} · ${contrastRatio(color, background).toFixed(2)}:1`, {
              size: 'sm',
              onClick: () => {
                foreground = color
                fg.hex.value = toHex(color)
                fg.swatch.value = toHex(color)
                run()
              },
            }),
          ),
        )
        error.hidden = true
      } catch (err) {
        ratio.textContent = ''
        error.textContent = err instanceof Error ? err.message : 'Could not read those colours.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Colours', icon: 'palette' },
          fg.root,
          bg.root,
          actions(button('Swap', { icon: 'refresh', onClick: () => {
            const swap = foreground
            foreground = background
            background = swap
            fg.hex.value = toHex(foreground)
            fg.swatch.value = toHex(foreground)
            bg.hex.value = toHex(background)
            bg.swatch.value = toHex(background)
            run()
          } })),
          error,
        ),
        panel({ title: 'Contrast', icon: 'info' }, el('div', { class: 'ts-k-actions' }, ratio), verdict, preview),
        panel({ title: 'Details', icon: 'list' }, rows),
        panel({ title: 'Try these foregrounds', icon: 'sparkle' }, suggestions),
        note('Contrast follows WCAG 2.1, including the linear segment for very dark colours. Translucent colours are composited over the other colour before measuring.'),
      ),
    )

    run()
  },
}

export default tool
