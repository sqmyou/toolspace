import {
  actions,
  copyRow,
  field,
  grid,
  kvList,
  note,
  outputBlock,
  panel,
  select,
  textField,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { buildClamp, convertAll, UNITS, type LengthUnit } from './units'

const tool: Tool = {
  slug: 'css-units',
  name: 'CSS Unit Converter & clamp()',
  description: 'Convert between px, rem, em, pt and more, and build fluid clamp() values.',
  category: 'Design',
  keywords: ['css', 'units', 'px', 'rem', 'em', 'pt', 'convert', 'clamp', 'fluid', 'responsive'],
  render(root) {
    const value = textField({ type: 'number', value: '16', mono: true, onInput: () => convert() })
    const unit = select({
      options: UNITS.map((item) => ({ value: item, label: item })),
      value: 'px',
      onChange: () => convert(),
    })
    const rootSize = textField({ type: 'number', value: '16', mono: true, onInput: () => { convert(); makeClamp() } })
    const error = note('', 'danger')
    error.hidden = true
    const rows = kvList()

    function convert() {
      rows.replaceChildren()
      try {
        const result = convertAll(Number(value.value), unit.value as LengthUnit, Number(rootSize.value) || 16)
        error.hidden = true
        rows.replaceChildren(...result.map((row) => copyRow(row.unit, `${row.value}${row.unit}`)))
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not convert that value.'
        error.hidden = false
      }
    }

    const clampFields = {
      minSize: textField({ type: 'number', value: '16', mono: true, onInput: () => makeClamp() }),
      maxSize: textField({ type: 'number', value: '24', mono: true, onInput: () => makeClamp() }),
      minViewport: textField({ type: 'number', value: '320', mono: true, onInput: () => makeClamp() }),
      maxViewport: textField({ type: 'number', value: '1200', mono: true, onInput: () => makeClamp() }),
    }
    let clampCss = ''
    const clampOut = outputBlock('', { label: 'clamp()', copy: () => clampCss })
    const clampError = note('', 'danger')
    clampError.hidden = true

    function makeClamp() {
      try {
        const result = buildClamp({
          minSize: Number(clampFields.minSize.value),
          maxSize: Number(clampFields.maxSize.value),
          minViewport: Number(clampFields.minViewport.value),
          maxViewport: Number(clampFields.maxViewport.value),
          root: Number(rootSize.value) || 16,
        })
        clampCss = result.css
        clampOut.body.replaceChildren(`font-size: ${result.css};`)
        clampOut.setMeta('')
        clampError.hidden = true
      } catch (err) {
        clampCss = ''
        clampOut.body.replaceChildren('')
        clampOut.setMeta('')
        clampError.textContent = err instanceof Error ? err.message : 'Could not build a clamp value.'
        clampError.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Convert a length', icon: 'ruler' },
          actions(
            field(value, { label: 'Value', grow: true }),
            field(unit, { label: 'Unit', grow: true }),
            field(rootSize, { label: 'Root font size (px)', grow: true }),
          ),
          error,
        ),
        panel({ title: 'Equivalent lengths', icon: 'layers' }, rows),
        panel(
          { title: 'Fluid clamp()', icon: 'sliders' },
          grid(140,
            field(clampFields.minSize, { label: 'Min size (px)' }),
            field(clampFields.maxSize, { label: 'Max size (px)' }),
            field(clampFields.minViewport, { label: 'Min viewport (px)' }),
            field(clampFields.maxViewport, { label: 'Max viewport (px)' }),
          ),
          clampError,
          clampOut,
        ),
        note('Conversions use the CSS reference pixel (96dpi).'),
      ),
    )

    convert()
    makeClamp()
  },
}

export default tool
