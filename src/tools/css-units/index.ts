import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { buildClamp, convertAll, UNITS, type LengthUnit } from './units'

const tool: Tool = {
  slug: 'css-units',
  name: 'CSS Unit Converter & clamp()',
  description: 'Convert between px, rem, em, pt and more, and build fluid clamp() values.',
  category: 'Design',
  keywords: ['css', 'units', 'px', 'rem', 'em', 'pt', 'convert', 'clamp', 'fluid', 'responsive'],
  render(root) {
    const numberInput = el('input', { class: 'ts-input ts-mono', type: 'number', value: '16', step: 'any', 'aria-label': 'Value' }) as HTMLInputElement
    const unitSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const unit of UNITS) unitSelect.append(el('option', { value: unit }, unit))
    const rootInput = el('input', { class: 'ts-input ts-mono', type: 'number', value: '16', step: 'any', 'aria-label': 'Root font size' }) as HTMLInputElement

    const rows = el('div', { class: 'ts-unit-list' })
    const error = el('p', { class: 'ts-error', hidden: true })

    function convert() {
      rows.replaceChildren()
      try {
        const root = Number(rootInput.value) || 16
        const result = convertAll(Number(numberInput.value), unitSelect.value as LengthUnit, root)
        error.hidden = true
        for (const row of result) {
          const line = el('div', { class: 'ts-unit-row' })
          line.append(el('span', { class: 'ts-unit-name' }, row.unit))
          line.append(el('code', { class: 'ts-unit-value' }, `${row.value}${row.unit}`))
          line.append(copyChip(() => `${row.value}${row.unit}`, 'Copy'))
          rows.append(line)
        }
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not convert that value.'
        error.hidden = false
      }
    }

    numberInput.addEventListener('input', convert)
    unitSelect.addEventListener('change', convert)
    rootInput.addEventListener('input', convert)

    const clampFields = {
      minSize: el('input', { class: 'ts-input ts-mono', type: 'number', value: '16', step: 'any' }) as HTMLInputElement,
      maxSize: el('input', { class: 'ts-input ts-mono', type: 'number', value: '24', step: 'any' }) as HTMLInputElement,
      minViewport: el('input', { class: 'ts-input ts-mono', type: 'number', value: '320', step: 'any' }) as HTMLInputElement,
      maxViewport: el('input', { class: 'ts-input ts-mono', type: 'number', value: '1200', step: 'any' }) as HTMLInputElement,
    }
    const clampOut = el('pre', { class: 'ts-clamp-out' })
    const clampError = el('p', { class: 'ts-error', hidden: true })
    let clampCss = ''

    function makeClamp() {
      try {
        const result = buildClamp({
          minSize: Number(clampFields.minSize.value),
          maxSize: Number(clampFields.maxSize.value),
          minViewport: Number(clampFields.minViewport.value),
          maxViewport: Number(clampFields.maxViewport.value),
          root: Number(rootInput.value) || 16,
        })
        clampCss = result.css
        clampOut.textContent = `font-size: ${result.css};`
        clampError.hidden = true
      } catch (err) {
        clampCss = ''
        clampOut.textContent = ''
        clampError.textContent = err instanceof Error ? err.message : 'Could not build a clamp value.'
        clampError.hidden = false
      }
    }
    for (const field of Object.values(clampFields)) field.addEventListener('input', makeClamp)
    rootInput.addEventListener('input', makeClamp)

    const field = (label: string, input: HTMLElement, suffix?: string) =>
      el('div', { class: 'ts-inline-field' }, el('label', {}, suffix ? `${label} (${suffix})` : label), input)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('h3', { class: 'ts-subhead' }, 'Convert a length'),
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          field('Value', numberInput),
          field('Unit', unitSelect),
          field('Root font size', rootInput, 'px'),
        ),
        error,
        rows,
        el('h3', { class: 'ts-subhead' }, 'Fluid clamp()'),
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          field('Min size', clampFields.minSize, 'px'),
          field('Max size', clampFields.maxSize, 'px'),
          field('Min viewport', clampFields.minViewport, 'px'),
          field('Max viewport', clampFields.maxViewport, 'px'),
        ),
        clampError,
        el('div', { class: 'ts-row ts-between' }, el('span'), copyChip(() => clampCss, 'Copy clamp()')),
        clampOut,
        el('p', { class: 'ts-note' }, 'Conversions use the CSS reference pixel (96dpi). Everything is computed locally.'),
      ),
    )

    convert()
    makeClamp()
  },
}

export default tool
