import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { bestTextColor, contrastRatio, parseColor, report, suggestForeground, toHex, toHslString, toRgbString, type Rgba } from './color'

function swatch(color: Rgba, label: string) {
  const box = el('span', { class: 'ts-swatch' })
  box.style.background = toHex(color)
  return el('div', { class: 'ts-swatch-row' }, box, el('span', { class: 'ts-muted' }, label))
}

const tool: Tool = {
  slug: 'color-contrast',
  name: 'Colour Contrast Checker',
  description: 'Check WCAG contrast between two colours and get a colour that passes.',
  category: 'Design',
  keywords: ['colour', 'color', 'contrast', 'wcag', 'accessibility', 'a11y', 'hex', 'hsl', 'luminance'],
  render(root) {
    const fg = el('input', { class: 'ts-input ts-mono', value: '#777777' }) as HTMLInputElement
    const bg = el('input', { class: 'ts-input ts-mono', value: '#ffffff' }) as HTMLInputElement
    const ratioOut = el('code', { class: 'ts-contrast-ratio' })
    const preview = el('div', { class: 'ts-contrast-preview' }, el('p', { class: 'ts-contrast-large' }, 'Large text 24px'), el('p', {}, 'Normal body text at the default size'), el('p', { class: 'ts-contrast-small' }, 'Small helper text'))
    const list = el('div', { class: 'ts-copy-list' })
    const error = el('p', { class: 'ts-error', hidden: true })
    const suggestion = el('div', { class: 'ts-row ts-wrap' })

    function run() {
      list.replaceChildren()
      suggestion.replaceChildren()
      try {
        const foreground = parseColor(fg.value)
        const background = parseColor(bg.value)
        const result = report(foreground, background)
        ratioOut.textContent = `${result.ratio.toFixed(2)}:1`

        preview.style.color = toHex(foreground)
        preview.style.background = toHex(background)

        const rows: [string, string][] = [
          ['Contrast ratio', `${result.ratio.toFixed(2)}:1`],
          ['Normal text (AA 4.5)', result.normalPass ? 'Pass' : 'Fail'],
          ['Large text (AA 3)', result.largePass ? 'Pass' : 'Fail'],
          ['Normal text (AAA 7)', result.aaaPass ? 'Pass' : 'Fail'],
          ['Foreground', `${toHex(foreground)} · ${toRgbString(foreground)} · ${toHslString(foreground)}`],
          ['Background', `${toHex(background)} · ${toRgbString(background)} · ${toHslString(background)}`],
        ]
        for (const [label, value] of rows) list.append(el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted ts-contrast-name' }, label), el('code', { class: 'ts-contrast-value' }, value), copyChip(value, 'Copy')))

        const fixed = suggestForeground(foreground, background, 4.5)
        const choices: [string, Rgba][] = [
          ['Black', { r: 0, g: 0, b: 0, a: 1 }],
          ['White', { r: 255, g: 255, b: 255, a: 1 }],
          ['Best match', bestTextColor(background)],
          ['Nearest passing', fixed],
        ]
        for (const [label, color] of choices) {
          const hex = toHex(color)
          const button = el('button', { class: 'ts-chip', type: 'button', onclick: () => { fg.value = hex; run() } }, `${label} ${hex} (${contrastRatio(color, background).toFixed(2)}:1)`)
          suggestion.append(button)
        }
        error.hidden = true
      } catch (err) {
        ratioOut.textContent = ''
        error.textContent = err instanceof Error ? err.message : 'Could not read those colours.'
        error.hidden = false
      }
    }

    fg.addEventListener('input', run)
    bg.addEventListener('input', run)

    const swap = el('button', { class: 'ts-button', type: 'button', onclick: () => { const value = fg.value; fg.value = bg.value; bg.value = value; run() } }, 'Swap')

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field ts-grow' }, el('label', {}, 'Foreground'), fg),
          el('div', { class: 'ts-inline-field ts-grow' }, el('label', {}, 'Background'), bg),
          swap,
        ),
        el('div', { class: 'ts-row ts-wrap' }, swatch(parseColor(fg.value), 'Foreground'), swatch(parseColor(bg.value), 'Background')),
        error,
        el('div', { class: 'ts-row ts-between' }, ratioOut, copyChip(() => ratioOut.textContent ?? '', 'Copy ratio')),
        preview,
        list,
        el('h3', { class: 'ts-subhead' }, 'Try these foregrounds'),
        suggestion,
        el('p', { class: 'ts-note' }, 'Contrast follows WCAG 2.1, including the linear segment for very dark colours. Translucent colours are composited over the other colour before measuring.'),
      ),
    )

    run()
  },
}

export default tool
