import { badge, copyRow, field, note, panel, select, stat, stats, textField, toolLayout } from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import {
  convert,
  currenciesUrl,
  formatMoney,
  latestUrl,
  parseCurrencies,
  parseRates,
  type Currency,
  type Rates,
} from './currency'

/** A small, always-available fallback so the tool is usable before the list loads. */
const FALLBACK: Currency[] = [
  { code: 'USD', name: 'United States Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'INR', name: 'Indian Rupee' },
]

const tool: Tool = {
  slug: 'currency-convert',
  name: 'Currency Converter',
  description: 'Convert between 30+ currencies using the European Central Bank\u2019s daily reference rates.',
  category: 'Numbers',
  keywords: ['currency', 'exchange', 'rate', 'convert', 'money', 'forex', 'fx', 'usd', 'eur', 'gbp'],
  remote: {
    host: 'api.frankfurter.dev',
    note: 'It asks the Frankfurter API (European Central Bank reference rates) for the exchange rate between the currencies you pick. Nothing about you is sent, and there is no sign-in.',
  },
  render(root) {
    const amount = textField({ type: 'number', value: '1', placeholder: '1', onInput: () => update() })
    amount.setAttribute('aria-label', 'Amount to convert')
    amount.min = '0'
    amount.step = 'any'

    const from = select({ options: FALLBACK.map(toOption), value: 'USD', onChange: () => void load() })
    from.setAttribute('aria-label', 'Convert from currency')
    const to = select({ options: FALLBACK.map(toOption), value: 'EUR', onChange: () => update() })
    to.setAttribute('aria-label', 'Convert to currency')

    const status = el('div', { class: 'ts-k-actions' })
    const summary = stats()
    const table = el('div', { class: 'ts-k-kvlist' })

    let rates: Rates | null = null

    function toOption(currency: Currency) {
      return { value: currency.code, label: `${currency.code} \u2014 ${currency.name}` }
    }

    function fill(currencies: Currency[]) {
      for (const node of [from, to]) {
        const previous = node.value
        node.replaceChildren(...currencies.map((currency) => el('option', { value: currency.code }, `${currency.code} \u2014 ${currency.name}`)))
        if (currencies.some((currency) => currency.code === previous)) node.value = previous
      }
    }

    async function load() {
      status.replaceChildren(badge('Loading rates\u2026', 'neutral'))
      try {
        const symbols = FALLBACK.map((currency) => currency.code).filter((code) => code !== from.value)
        const response = await fetch(latestUrl(from.value, symbols), { headers: { accept: 'application/json' } })
        if (!response.ok) {
          status.replaceChildren(badge(`The rate service returned HTTP ${response.status}.`, 'danger'))
          rates = null
          return
        }
        rates = parseRates(await response.json())
        status.replaceChildren(badge(`Rates updated ${rates.date}`, 'ok'))
        update()
      } catch {
        status.replaceChildren(badge('Could not reach the rate service. Check your connection.', 'danger'))
        rates = null
        update()
      }
    }

    function update() {
      const value = Number(amount.value)
      const rate = rates?.rates[to.value]
      if (!rates || rate === undefined) {
        summary.hidden = true
        table.replaceChildren(note('Enter an amount and a currency pair to convert.', 'neutral'))
        return
      }
      const result = convert(value, rate)
      const unit = convert(1, rate)
      summary.hidden = false
      summary.replaceChildren(
        stat({ label: 'result', value: formatMoney(result, to.value) }),
        stat({ label: 'rate', value: `1 ${rates.base} = ${unit.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${to.value}` }),
        stat({ label: 'date', value: rates.date }),
      )
      table.replaceChildren(
        copyRow('Converted', formatMoney(result, to.value)),
        copyRow('Rate', `1 ${rates.base} = ${rate} ${to.value}`),
        copyRow('Inverse', `1 ${to.value} = ${(1 / rate).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${rates.base}`),
      )
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Convert', icon: 'repeat' },
          el('div', { class: 'ts-k-split' }, field(amount, { label: 'Amount' }), field(from, { label: 'From' }), field(to, { label: 'To' })),
          status,
          summary,
          note('This tool uses the network. It sends only the currency codes you pick, to api.frankfurter.dev, and gets back the European Central Bank reference rate. It is not a live trading rate.'),
        ),
        panel({ title: 'Result', icon: 'info' }, table),
      ),
    )

    // Populate the full currency list in the background, then take the first rates.
    void (async () => {
      try {
        const response = await fetch(currenciesUrl(), { headers: { accept: 'application/json' } })
        if (response.ok) {
          const currencies = parseCurrencies(await response.json())
          if (currencies.length > 8) fill(currencies)
        }
      } catch {
        // The fallback list is already usable; the rate load below reports failures.
      }
      await load()
    })()
  },
}

export default tool
