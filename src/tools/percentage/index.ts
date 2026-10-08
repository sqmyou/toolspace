import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { applyDiscount, marginAndMarkup, percentBreakdown, percentChange, percentOf, percentOfTotal, reversePercent, round } from './percentage'

function numberField(label: string, value: string) {
  const input = el('input', { class: 'ts-input ts-mono', type: 'number', value, 'aria-label': label }) as HTMLInputElement
  return { input, node: el('div', { class: 'ts-field' }, el('label', {}, label), input) }
}

function resultRow(label = 'Result') {
  const value = el('code', { class: 'ts-percent-value' })
  const node = el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted ts-percent-name' }, label), value, copyChip(() => value.textContent ?? '', 'Copy'))
  return { value, node }
}

const tool: Tool = {
  slug: 'percentage',
  name: 'Percentage Calculator',
  description: 'Work out shares, increases, decreases, discounts and margins without guessing.',
  category: 'Numbers',
  keywords: ['percentage', 'percent', 'increase', 'decrease', 'discount', 'markup', 'margin', 'share'],
  render(root) {
    const ofPercent = numberField('Percentage (%)', '20')
    const ofValue = numberField('Of value', '150')
    const partValue = numberField('Part', '25')
    const totalValue = numberField('Total', '200')
    const changeFrom = numberField('From', '100')
    const changeTo = numberField('To', '150')
    const reverseResult = numberField('Result', '150')
    const reversePercentValue = numberField('Was changed by (%)', '50')
    const price = numberField('Price', '200')
    const discount = numberField('Discount (%)', '25')
    const cost = numberField('Cost', '80')
    const sellPrice = numberField('Price', '100')

    const shareResult = resultRow()
    const totalResult = resultRow()
    const changeResult = resultRow()
    const reverseOut = resultRow()
    const discountResult = resultRow()
    const marginResult = resultRow()

    const breakdownInput = el('textarea', { class: 'ts-textarea ts-mono', rows: 3, spellcheck: false }, '1, 1, 2') as HTMLTextAreaElement
    const breakdownOut = el('div', { class: 'ts-copy-list' })

    function safe(target: HTMLElement, compute: () => string) {
      try {
        target.textContent = compute()
      } catch {
        target.textContent = '—'
      }
    }

    function compute() {
      const number = (field: { input: HTMLInputElement }) => Number(field.input.value)
      safe(shareResult.value, () => `${round(percentOf(number(ofPercent), number(ofValue)))}`)
      safe(totalResult.value, () => `${round(percentOfTotal(number(partValue), number(totalValue)))}%`)
      safe(changeResult.value, () => `${round(percentChange(number(changeFrom), number(changeTo)))}%`)
      safe(reverseOut.value, () => `${round(reversePercent(number(reverseResult), number(reversePercentValue)))}`)
      safe(discountResult.value, () => `${round(applyDiscount(number(price), number(discount)))}`)
      safe(marginResult.value, () => {
        const result = marginAndMarkup(number(cost), number(sellPrice))
        return `${round(result.margin)}% margin · ${round(result.markup)}% markup`
      })

      breakdownOut.replaceChildren()
      try {
        const values = breakdownInput.value.split(/[\s,;]+/).filter(Boolean).map(Number)
        for (const share of percentBreakdown(values)) breakdownOut.append(el('div', { class: 'ts-copy-row' }, el('code', { class: 'ts-percent-value' }, `${round(share)}%`)))
      } catch (err) {
        breakdownOut.append(el('p', { class: 'ts-error' }, err instanceof Error ? err.message : 'Could not read those values.'))
      }
    }

    for (const { input } of [ofPercent, ofValue, partValue, totalValue, changeFrom, changeTo, reverseResult, reversePercentValue, price, discount, cost, sellPrice]) input.addEventListener('input', compute)
    breakdownInput.addEventListener('input', compute)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-percent-grid' },
          el('div', { class: 'ts-percent-card' }, el('h3', { class: 'ts-subhead' }, 'Share of a value'), ofPercent.node, ofValue.node, shareResult.node),
          el('div', { class: 'ts-percent-card' }, el('h3', { class: 'ts-subhead' }, 'Part as a share'), partValue.node, totalValue.node, totalResult.node),
          el('div', { class: 'ts-percent-card' }, el('h3', { class: 'ts-subhead' }, 'Change between two values'), changeFrom.node, changeTo.node, changeResult.node),
          el('div', { class: 'ts-percent-card' }, el('h3', { class: 'ts-subhead' }, 'Reverse a change'), reverseResult.node, reversePercentValue.node, reverseOut.node),
          el('div', { class: 'ts-percent-card' }, el('h3', { class: 'ts-subhead' }, 'Discount'), price.node, discount.node, discountResult.node),
          el('div', { class: 'ts-percent-card' }, el('h3', { class: 'ts-subhead' }, 'Margin and markup'), cost.node, sellPrice.node, marginResult.node),
        ),
        el('h3', { class: 'ts-subhead' }, 'Split values into shares'),
        breakdownInput,
        breakdownOut,
        el('p', { class: 'ts-note' }, 'Dividing by zero shows a dash rather than Infinity. Margin is profit over price, markup is profit over cost.'),
      ),
    )

    compute()
  },
}

export default tool
