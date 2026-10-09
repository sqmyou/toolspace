import { actions, badge, button, note, panel, stat, stats, textField, toolLayout } from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import {
  describeCode,
  forecastUrl,
  geocodeUrl,
  parseForecast,
  parsePlace,
  weekday,
  type Forecast,
} from './weather'

const SAMPLE = 'Berlin'

const tool: Tool = {
  slug: 'weather-forecast',
  name: 'Weather',
  description: 'A seven-day forecast for any city, from Open-Meteo. No API key, no account, no tracking.',
  category: 'Web',
  keywords: ['weather', 'forecast', 'temperature', 'rain', 'snow', 'city', 'meteo', 'climate', 'rain'],
  remote: {
    host: 'api.open-meteo.com',
    note: 'It sends the place name you type to Open-Meteo\u2019s public geocoder, then asks the forecast API for that spot. Only the place name and its coordinates are sent; no key, no cookies, no tracking.',
  },
  render(root) {
    const input = textField({ value: SAMPLE, placeholder: 'City name\u2026', onInput: () => queue() })
    input.spellcheck = false
    input.setAttribute('aria-label', 'City name for the forecast')

    const status = el('div', { class: 'ts-k-actions' })
    const summary = stats()
    summary.hidden = true
    const current = el('div', { class: 'ts-k-current' })
    const days = el('div', { class: 'ts-k-forecast' })

    let seq = 0
    let timer: number | undefined

    function queue() {
      window.clearTimeout(timer)
      timer = window.setTimeout(lookUp, 450)
    }

    function reset() {
      summary.hidden = true
      current.replaceChildren()
      days.replaceChildren()
    }

    function paint(forecast: Forecast) {
      const temperatureUnit = forecast.units.temperature
      const now = forecast.current
      if (now) {
        const sky = describeCode(now.code)
        summary.hidden = false
        summary.replaceChildren(
          stat({ label: 'now', value: `${Math.round(now.temperature)}${temperatureUnit}` }),
          stat({ label: 'feels like', value: `${Math.round(now.apparent)}${temperatureUnit}` }),
          stat({ label: 'humidity', value: `${Math.round(now.humidity)}%` }),
          stat({ label: 'wind', value: `${Math.round(now.wind)} ${forecast.units.wind}` }),
        )
        current.replaceChildren(
          el('span', { class: 'ts-k-current__glyph', 'aria-hidden': 'true' }, sky.glyph),
          el('span', { class: 'ts-k-current__label' }, sky.label),
        )
      } else {
        summary.hidden = true
        current.replaceChildren()
      }

      days.replaceChildren(
        ...forecast.days.map((day) => {
          const sky = describeCode(day.code)
          return el(
            'div',
            { class: 'ts-k-day' },
            el('span', { class: 'ts-k-day__name' }, weekday(day.date)),
            el('span', { class: 'ts-k-day__glyph', 'aria-hidden': 'true' }, sky.glyph),
            el('span', { class: 'ts-k-day__label' }, sky.label),
            el('span', { class: 'ts-k-day__temp' }, `${Math.round(day.max)}\u00b0 / ${Math.round(day.min)}\u00b0`),
            Number.isFinite(day.precipitation) ? el('span', { class: 'ts-k-day__rain' }, `${Math.round(day.precipitation)}% rain`) : '',
          )
        }),
      )
    }

    async function lookUp() {
      const self = ++seq
      const query = input.value.trim()
      if (query === '') {
        status.replaceChildren()
        reset()
        return
      }

      status.replaceChildren(badge(`Finding ${query}\u2026`, 'neutral'))
      try {
        const geoResponse = await fetch(geocodeUrl(query), { headers: { accept: 'application/json' } })
        if (self !== seq) return
        if (!geoResponse.ok) {
          status.replaceChildren(badge(`The geocoder returned HTTP ${geoResponse.status}.`, 'danger'))
          reset()
          return
        }
        const place = parsePlace(await geoResponse.json())
        if (self !== seq) return
        if (!place) {
          status.replaceChildren(badge(`Could not find a place called \u201c${query}\u201d.`, 'warn'))
          reset()
          return
        }

        status.replaceChildren(badge(`Forecast for ${place.name}\u2026`, 'neutral'))
        const forecastResponse = await fetch(forecastUrl(place.latitude, place.longitude), {
          headers: { accept: 'application/json' },
        })
        if (self !== seq) return
        if (!forecastResponse.ok) {
          status.replaceChildren(badge(`The forecast service returned HTTP ${forecastResponse.status}.`, 'danger'))
          reset()
          return
        }
        const forecast = parseForecast(await forecastResponse.json())
        if (self !== seq) return
        const where = [place.name, place.admin1, place.country].filter(Boolean).join(', ')
        status.replaceChildren(badge(where, 'ok'))
        paint(forecast)
      } catch {
        if (self !== seq) return
        status.replaceChildren(badge('Could not reach the weather service. Check your connection.', 'danger'))
        reset()
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Place', icon: 'globe' },
          input,
          actions(
            button('Forecast', { icon: 'search', variant: 'primary', onClick: () => void lookUp() }),
            button('Clear', {
              onClick: () => {
                input.value = ''
                input.focus()
                void lookUp()
              },
            }),
          ),
          status,
          note('This tool uses the network. Only the place name you type is sent, to Open-Meteo\u2019s public geocoder and forecast API. Nothing else leaves this page.'),
        ),
        panel({ title: 'Right now', icon: 'bolt' }, current, summary),
        panel({ title: 'Seven days', icon: 'calendar' }, days),
      ),
    )

    void lookUp()
  },
}

export default tool
