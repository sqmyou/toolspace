import {
  actions,
  button,
  copyRow,
  field,
  kvList,
  note,
  outputBlock,
  panel,
  select,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { CATEGORIES, convertToAll, convertUnit, findCategory, findUnit, formatUnitValue, parseUnitInput, UnitError } from './units'

const tool: Tool = {
  slug: 'unit-converter',
  name: 'Unit Converter',
  description: 'Convert length, mass, temperature, area, volume, speed, data rate and more.',
  category: 'Numbers',
  icon: 'ruler',
  keywords: [
    'unit',
    'converter',
    'convert',
    'measurement',
    'metric',
    'imperial',
    'length',
    'mass',
    'weight',
    'temperature',
    'celsius',
    'fahrenheit',
    'area',
    'volume',
    'speed',
    'data rate',
    'pressure',
    'energy',
    'power',
    'angle',
  ],
  render(root) {
    let category = CATEGORIES[0]
    let fromId = category.defaultUnit
    let toId = category.units[1]?.id ?? category.defaultUnit

    const categorySelect = select({
      options: CATEGORIES.map((item) => ({ value: item.id, label: item.name })),
      value: category.id,
      onChange: (value) => {
        category = findCategory(value) ?? CATEGORIES[0]
        fromId = category.defaultUnit
        toId = category.units.find((unit) => unit.id !== fromId)?.id ?? fromId
        syncUnits()
        run()
      },
    })

    const fromSelect = select({
      options: [],
      onChange: (value) => {
        fromId = value
        run()
      },
    })
    const toSelect = select({
      options: [],
      onChange: (value) => {
        toId = value
        run()
      },
    })

    const input = textField({ value: '1', mono: true, onInput: () => run() })
    input.setAttribute('inputmode', 'decimal')
    input.setAttribute('autocomplete', 'off')
    input.setAttribute('spellcheck', 'false')

    const error = note('', 'danger')
    error.hidden = true

    const result = outputBlock('—', { label: 'Result', copy: () => result.body.textContent ?? '' })
    const all = kvList()
    const allPanel = panel({ title: 'All units', icon: 'chart' }, all)

    function syncUnits() {
      const options = category.units.map((unit) => ({ value: unit.id, label: `${unit.name} (${unit.symbol})` }))
      fromSelect.replaceChildren(
        ...options.map((option) =>
          el('option', { value: option.value, selected: option.value === fromId }, option.label),
        ),
      )
      toSelect.replaceChildren(
        ...options.map((option) =>
          el('option', { value: option.value, selected: option.value === toId }, option.label),
        ),
      )
      fromSelect.value = fromId
      toSelect.value = toId
    }

    function swap() {
      const previousFrom = fromId
      fromId = toId
      toId = previousFrom
      syncUnits()
      run()
    }

    function run() {
      const from = findUnit(category, fromId)
      const to = findUnit(category, toId)
      if (!from || !to) return
      let value: number
      try {
        value = parseUnitInput(input.value)
      } catch (err) {
        result.setValue('—')
        result.setMeta('')
        all.replaceChildren()
        error.textContent = err instanceof UnitError ? err.message : 'Could not read that value.'
        error.hidden = false
        return
      }
      error.hidden = true
      const converted = convertUnit(value, from, to)
      result.setValue(`${formatUnitValue(converted)} ${to.symbol}`)
      result.setMeta(`${formatUnitValue(value)} ${from.symbol} → ${to.symbol}`)

      all.replaceChildren(
        ...convertToAll(value, from, category).map((row) =>
          copyRow(`${row.unit.name} (${row.unit.symbol})`, formatUnitValue(row.value)),
        ),
      )
    }

    syncUnits()

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Convert', icon: 'ruler' },
          field(categorySelect, { label: 'Category' }),
          actions(
            field(input, { label: 'Value', grow: true }),
            button('Swap', { icon: 'swap', onClick: swap }),
          ),
          el('div', { class: 'ts-k-split' }, field(fromSelect, { label: 'From' }), field(toSelect, { label: 'To' })),
          error,
        ),
        result,
        allPanel,
              ),
    )

    run()
  },
}

export default tool
