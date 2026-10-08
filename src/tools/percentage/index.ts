import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { applyDiscount, applyMarkup, marginAndMarkup, percentBreakdown, percentChange, percentOf, percentOfTotal, reversePercent, round } from './percentage'

function field(label: string, value: string, type = 'number') {
  const input = el('input', { class: 'ts-input ts-mono', type, value, 'aria-label': label }) as HTMLInputElement
  return { input, node: el('div', { class: 'ts-field' }, el('label', {}, label), input) }
}

const tool: Tool = {
  slug: 'percentage',
  name: 'Percentage Calculator',
  description: 'Work out shares, increases, decreases, discounts and margins without guessing.',
  category: 'Numbers',
  keywords: ['percentage', 'percent', 'increase', 'decrease', 'discount', 'markup', 'margin', 'share'],
  render(root) {
    const rows: { label: string; result: HTMLElement }[] = []

    function row(label: string, compute: () => string) {
      const value = el('code', { class: 'ts-percent-value' })
      const line = el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted ts-percent-name' }, label), value, copyChip(() => value.textContent ?? '', 'Copy'))
      rows.push({
        label,
        result: value,
      })
      ;(value as HTMLElement & { compute?: () => string }).compute = compute
      return line
    }

    const ofPercent = field('Percentage (%)', '20')
    const ofValue = field('Of value', '150')
    const partValue = field('Part', '25')
    const totalValue = field('Total', '200')
    const changeFrom = field('From', '100')
    const changeTo = field('To', '150')
    const reverseResult = field('Result', '150')
    const reversePercentValue = field('Was changed by (%)', '50')
    const price = field('Price', '200')
    const discount = field('Discount (%)', '25')
    const cost = field('Cost', '80')
    const sellPrice = field('Price', '100')
    const breakdownInput = el('textarea', { class: 'ts-textarea ts-mono', rows: 4, spellcheck: false }, '1, 1, 2') as HTMLTextAreaElement
    const breakdownOut = el('div', { class: 'ts-copy-list' })
    const error = el('p', { class: 'ts-error', hidden: true })

    function compute() {
      error.hidden = true
      const set = (target: HTMLElement, computeValue: () => string) => {
        try {
          target.textContent = computeValue()
        } catch {
          target.textContent = '—'
        }
      }
      set(ofPercent.input.closest('.ts-field') ? (rows[0].result) : (rows[0].result), () => `${round(percentOf(Number(ofPercent.input.value), Number(ofValue.input.value)))}`)
      set(rows[1].result, () => `${round(percentOfTotal(Number(partValue.input.value), Number(totalValue.input.value)))}%`)
      set(rows[2].result, () => `${round(percentChange(Number(changeFrom.input.value), Number(changeTo.input.value)))}%`)
      set(rows[3].result, () => `${round(reversePercent(Number(reverseResult.input.value), Number(reversePercentValue.input.value)))}`)
      set(rows[4].result, () => `${round(applyDiscount(Number(price.input.value), Number(discount.input.value)))}`)
      const margin = () => {
        const result = marginAndMarkup(Number(cost.input.value), Number(sellPrice.input.value))
        return `${round(result.margin)}% margin · ${round(result.markup)}% markup`
      }
      set(rows[5].result, margin)

      try {
        const values = breakdownInput.value.split(/[\s,;]+/).filter(Boolean).map(Number)
        breakdownOut.replaceChildren()
        for (const share of percentBreakdown(values)) breakdownOut.append(el('div', { class: 'ts-copy-row' }, el('code', { class: 'ts-percent-value' }, `${round(share)}%`)))
      } catch (err) {
        breakdownOut.replaceChildren(el('p', { class: 'ts-error' }, err instanceof Error ? err.message : 'Could not read those values.'))
      }
    }

    const inputs = [ofPercent, ofValue, partValue, totalValue, changeFrom, changeTo, reverseResult, reversePercentValue, price, discount, cost, sellPrice]
    for (const { input } of inputs) input.addEventListener('input', compute)
    breakdownInput.addEventListener('input', compute)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-percent-grid' },
          el('div', { class: 'ts-percent-card' }, el('h3', { class: 'ts-subhead' }, 'Share of a value'), ofPercent.node, ofValue.node, row('Result', () => '')),
          el('div', { class: 'ts-percent-card' }, el('h3', { class: 'ts-subhead' }, 'Part as a share'), partValue.node, totalValue.node, row('Result', () => '')),
          el('div', { class: 'ts-percent-card' }, el('h3', { class: 'ts-subhead' }, 'Change between two values'), changeFrom.node, changeTo.node, row('Result', () => '')),
          el('div', { class: 'ts-percent-card' }, el('h3', { class: 'ts-subhead' }, 'Reverse a change'), reverseResult.node, reversePercentValue.node, row('Result', () => '')),
          el('div', { class: 'ts-percent-card' }, el('h3', { class: 'ts-subhead' }, 'Discount'), price.node, discount.node, row('Result', () => '')),
          el('div', { class: 'ts-percent-card' }, el('h3', { class: 'ts-subhead' }, 'Margin and markup'), cost.node, sellPrice.node, row('Result', () => '')),
        ),
        error,
        el('h3', { class: 'ts-subhead' }, 'Split values into shares'),
        breakdownInput,
        breakdownOut,
        el('p', { class: 'ts-note' }, 'Dividing by zero is reported as a dash rather than Infinity. Margin is profit over price, markup is profit over cost.'),
      ),
    )

    compute()
    void applyMarkup
  },
}

export default tool
