import { el } from '../../core/dom'
import {
  copyButton,
  field,
  grid,
  note,
  panel,
  stat,
  stats,
  textarea,
  textField,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { applyDiscount, marginAndMarkup, percentBreakdown, percentChange, percentOf, percentOfTotal, reversePercent, round } from './percentage'

function numberField(label: string, value: string) {
  const input = textField({ value, type: 'number', mono: true, onInput: () => {} })
  input.setAttribute('aria-label', label)
  return { input, node: field(input, { label }) }
}

function resultRow(label = 'Result') {
  const value = el('span', { class: 'ts-percent-value' })
  const node = el(
    'div',
    { class: 'ts-percent-result' },
    el('span', { class: 'ts-percent-result__label' }, label),
    value,
    copyButton(() => value.textContent ?? '', { size: 'sm' }),
  )
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

    const breakdownInput = textarea({ rows: 3, value: '1, 1, 2', placeholder: '1, 1, 2', onInput: () => compute() })
    const breakdownOut = stats()

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
        return `${round(result.margin)}% · ${round(result.markup)}%`
      })

      try {
        const values = breakdownInput.value.split(/[\s,;]+/).filter(Boolean).map(Number)
        breakdownOut.replaceChildren(...percentBreakdown(values).map((share) => stat({ label: 'Share', value: `${round(share)}%` })))
      } catch (err) {
        breakdownOut.replaceChildren(stat({ label: 'Error', value: err instanceof Error ? err.message : 'Could not read those values.' }))
      }
    }

    for (const { input } of [ofPercent, ofValue, partValue, totalValue, changeFrom, changeTo, reverseResult, reversePercentValue, price, discount, cost, sellPrice]) input.addEventListener('input', compute)

    root.append(
      toolLayout(
        { wide: true },
        grid(300,
          panel(
          { title: 'Share of a value', icon: 'hash', meta: 'a% of b' },
          ofPercent.node,
          ofValue.node,
          shareResult.node,
        ),
        panel(
          { title: 'Part as a share', icon: 'ruler', meta: 'part ÷ total' },
          partValue.node,
          totalValue.node,
          totalResult.node,
        ),
        panel(
          { title: 'Change between two values', icon: 'arrowUp', meta: 'from → to' },
          changeFrom.node,
          changeTo.node,
          changeResult.node,
        ),
        panel(
          { title: 'Reverse a change', icon: 'arrowDown', meta: 'undo a %' },
          reverseResult.node,
          reversePercentValue.node,
          reverseOut.node,
        ),
        panel(
          { title: 'Discount', icon: 'eraser', meta: 'price − %' },
          price.node,
          discount.node,
          discountResult.node,
        ),
        panel(
          { title: 'Margin and markup', icon: 'sliders', meta: 'cost vs price' },
          cost.node,
          sellPrice.node,
          marginResult.node,
        ),
        panel(
          { title: 'Split values into shares', icon: 'layers' },
          breakdownInput,
          breakdownOut,
        ),
        ),
        note('Dividing by zero shows a dash rather than Infinity. Margin is profit over price, markup is profit over cost.'),
      ),
    )

    compute()
  },
}

export default tool
