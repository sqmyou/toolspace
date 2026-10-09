import {
  actions,
  checkbox,
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
import { formatNumber, parseNumber, representations } from './format'

const LOCALES = ['en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES', 'hi-IN', 'ja-JP']

const tool: Tool = {
  slug: 'number-formatter',
  name: 'Number Formatter',
  description: 'Format a number for any locale and see its compact, currency, binary and word forms.',
  category: 'Numbers',
  keywords: ['number', 'format', 'locale', 'currency', 'percent', 'compact', 'thousands', 'words'],
  render(root) {
    const input = textField({ value: '1234567.89', mono: true, onInput: () => run() })
    const locale = select({
      options: LOCALES.map((code) => ({ value: code, label: code })),
      value: 'en-US',
      onChange: () => run(),
    })
    const style = select({
      options: [
        { value: 'decimal', label: 'Decimal' },
        { value: 'currency', label: 'Currency' },
        { value: 'percent', label: 'Percent' },
        { value: 'unit', label: 'Unit' },
      ],
      value: 'decimal',
      onChange: () => run(),
    })
    const currency = textField({ value: 'USD', mono: true, onInput: () => run() })
    const unit = textField({ value: 'kilometer', mono: true, onInput: () => run() })
    const decimals = textField({ type: 'number', value: '2', mono: true, onInput: () => run() })
    const sign = select({
      options: [
        { value: 'auto', label: 'Auto' },
        { value: 'always', label: 'Always' },
        { value: 'never', label: 'Never' },
        { value: 'exceptZero', label: 'Except zero' },
      ],
      value: 'auto',
      onChange: () => run(),
    })
    let compact = false
    const error = note('', 'danger')
    error.hidden = true
    const rows = kvList()
    let main = ''
    const result = outputBlock('', { label: 'Formatted', copy: () => main })

    function run() {
      rows.replaceChildren()
      try {
        const value = parseNumber(input.value)
        main = formatNumber(value, {
          locale: locale.value,
          style: style.value as 'decimal' | 'currency' | 'percent' | 'unit',
          currency: currency.value,
          unit: unit.value,
          minimumFractionDigits: Number(decimals.value) || 0,
          maximumFractionDigits: Number(decimals.value) || 0,
          compact,
          signDisplay: sign.value as 'auto' | 'always' | 'never' | 'exceptZero',
        })
        result.body.replaceChildren(main)
        result.setMeta('')
        rows.replaceChildren(...representations(value, locale.value).map(([label, text]) => copyRow(label, text)))
        error.hidden = true
      } catch (err) {
        main = ''
        result.body.replaceChildren('')
        result.setMeta('')
        error.textContent = err instanceof Error ? err.message : 'Could not format that number.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Format', icon: 'sliders' },
          field(input, { label: 'Number' }),
          grid(160,
            field(locale, { label: 'Locale' }),
            field(style, { label: 'Style' }),
            field(decimals, { label: 'Decimals' }),
            field(sign, { label: 'Sign' }),
            field(currency, { label: 'Currency' }),
            field(unit, { label: 'Unit' }),
          ),
          actions(checkbox({ label: 'Compact notation', onChange: (checked) => { compact = checked; run() } })),
          error,
        ),
        result,
        panel({ title: 'Other representations', icon: 'hash' }, rows),
        note('Parsing accepts "1,234.56" and "1.234,56" by looking at which separator comes last. Formatting uses the browser Intl data.'),
      ),
    )

    run()
  },
}

export default tool
