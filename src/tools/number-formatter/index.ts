import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
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
    const input = el('input', { class: 'ts-input ts-mono', value: '1234567.89' }) as HTMLInputElement
    const locale = el('select', { class: 'ts-select' }, ...LOCALES.map((code) => el('option', { value: code }, code))) as HTMLSelectElement
    const style = el(
      'select',
      { class: 'ts-select' },
      el('option', { value: 'decimal' }, 'Decimal'),
      el('option', { value: 'currency' }, 'Currency'),
      el('option', { value: 'percent' }, 'Percent'),
      el('option', { value: 'unit' }, 'Unit'),
    ) as HTMLSelectElement
    const currency = el('input', { class: 'ts-input ts-mono', value: 'USD', maxlength: 3 }) as HTMLInputElement
    const unit = el('input', { class: 'ts-input ts-mono', value: 'kilometer' }) as HTMLInputElement
    const decimals = el('input', { class: 'ts-input ts-mono', type: 'number', min: '0', max: '20', value: '2' }) as HTMLInputElement
    const compact = el('input', { type: 'checkbox' }) as HTMLInputElement
    const sign = el('select', { class: 'ts-select' }, el('option', { value: 'auto' }, 'Auto'), el('option', { value: 'always' }, 'Always'), el('option', { value: 'never' }, 'Never'), el('option', { value: 'exceptZero' }, 'Except zero')) as HTMLSelectElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const list = el('div', { class: 'ts-copy-list' })
    let main = ''

    function run() {
      list.replaceChildren()
      try {
        const value = parseNumber(input.value)
        const options = {
          locale: locale.value,
          style: style.value as 'decimal' | 'currency' | 'percent' | 'unit',
          currency: currency.value,
          unit: unit.value,
          minimumFractionDigits: Number(decimals.value) || 0,
          maximumFractionDigits: Number(decimals.value) || 0,
          compact: compact.checked,
          signDisplay: sign.value as 'auto' | 'always' | 'never' | 'exceptZero',
        }
        main = formatNumber(value, options)
        const rows: [string, string][] = [['Formatted', main], ...representations(value, locale.value)]
        for (const [label, text] of rows) list.append(el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted ts-format-name' }, label), el('code', { class: 'ts-format-value' }, text), copyChip(text, 'Copy')))
        error.hidden = true
      } catch (err) {
        main = ''
        error.textContent = err instanceof Error ? err.message : 'Could not format that number.'
        error.hidden = false
      }
    }

    for (const node of [input, currency, unit, decimals]) node.addEventListener('input', run)
    for (const node of [locale, style, sign, compact]) node.addEventListener('change', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field ts-grow' }, el('label', {}, 'Number'), input),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Locale'), locale),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Style'), style),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Decimals'), decimals),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Currency'), currency),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Unit'), unit),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Sign'), sign),
          el('label', { class: 'ts-inline-field' }, compact, 'Compact'),
        ),
        error,
        el('div', { class: 'ts-row ts-between' }, el('code', { class: 'ts-format-main' }, main), copyChip(() => main, 'Copy')),
        list,
        el('p', { class: 'ts-note' }, 'Parsing accepts "1,234.56" and "1.234,56" by looking at which separator comes last. Formatting uses the browser Intl data.'),
      ),
    )

    run()
  },
}

export default tool
