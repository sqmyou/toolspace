/**
 * Weather and a place search via Open-Meteo.
 *
 * A *network* tool: it geocodes the place you type and asks Open-Meteo for its
 * forecast, so it declares itself with `remote`. Parsing and the WMO code
 * lookups are pure, so they are tested without the network. Open-Meteo needs
 * no key, sets no cookies and answers any origin.
 */

const GEO = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST = 'https://api.open-meteo.com/v1/forecast'

export function geocodeUrl(query: string): string {
  const params = new URLSearchParams({ name: query, count: '1', language: 'en', format: 'json' })
  return `${GEO}?${params.toString()}`
}

export function forecastUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '7',
  })
  return `${FORECAST}?${params.toString()}`
}

export interface Place {
  name: string
  country: string
  admin1: string
  latitude: number
  longitude: number
  timezone: string
}

/** Parse a geocoding response into the first match, or null. Pure. */
export function parsePlace(payload: unknown): Place | null {
  if (typeof payload !== 'object' || payload === null) return null
  const results = (payload as { results?: unknown }).results
  if (!Array.isArray(results) || results.length === 0) return null
  const first = results[0] as Record<string, unknown>
  if (typeof first.latitude !== 'number' || typeof first.longitude !== 'number') return null
  return {
    name: typeof first.name === 'string' ? first.name : '',
    country: typeof first.country === 'string' ? first.country : '',
    admin1: typeof first.admin1 === 'string' ? first.admin1 : '',
    latitude: first.latitude,
    longitude: first.longitude,
    timezone: typeof first.timezone === 'string' ? first.timezone : 'UTC',
  }
}

export interface CurrentWeather {
  temperature: number
  apparent: number
  humidity: number
  wind: number
  code: number
}

export interface DayForecast {
  date: string
  code: number
  max: number
  min: number
  precipitation: number
}

export interface Forecast {
  current: CurrentWeather | null
  days: DayForecast[]
  units: { temperature: string; wind: string }
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number.NaN
}

/** Parse a forecast response. Pure. */
export function parseForecast(payload: unknown): Forecast {
  const data = (payload ?? {}) as Record<string, unknown>
  const units = (data.current_units ?? {}) as { temperature_2m?: unknown; wind_speed_10m?: unknown }
  const currentRaw = data.current as Record<string, unknown> | undefined
  const current: CurrentWeather | null = currentRaw
    ? {
        temperature: num(currentRaw.temperature_2m),
        apparent: num(currentRaw.apparent_temperature),
        humidity: num(currentRaw.relative_humidity_2m),
        wind: num(currentRaw.wind_speed_10m),
        code: num(currentRaw.weather_code),
      }
    : null

  const daily = (data.daily ?? {}) as Record<string, unknown>
  const dates = Array.isArray(daily.time) ? (daily.time as unknown[]) : []
  const codes = Array.isArray(daily.weather_code) ? (daily.weather_code as unknown[]) : []
  const maxes = Array.isArray(daily.temperature_2m_max) ? (daily.temperature_2m_max as unknown[]) : []
  const mins = Array.isArray(daily.temperature_2m_min) ? (daily.temperature_2m_min as unknown[]) : []
  const precip = Array.isArray(daily.precipitation_probability_max) ? (daily.precipitation_probability_max as unknown[]) : []

  const days: DayForecast[] = dates.map((date, index) => ({
    date: String(date),
    code: num(codes[index]),
    max: num(maxes[index]),
    min: num(mins[index]),
    precipitation: num(precip[index]),
  }))

  return {
    current,
    days,
    units: {
      temperature: typeof units.temperature_2m === 'string' ? units.temperature_2m : '\u00b0C',
      wind: typeof units.wind_speed_10m === 'string' ? units.wind_speed_10m : 'km/h',
    },
  }
}

/** WMO weather interpretation codes, as used by Open-Meteo. */
export function describeCode(code: number): { label: string; glyph: string } {
  const table: Record<number, [string, string]> = {
    0: ['Clear sky', '\u2600\ufe0f'],
    1: ['Mainly clear', '\ud83c\udf24\ufe0f'],
    2: ['Partly cloudy', '\u26c5'],
    3: ['Overcast', '\u2601\ufe0f'],
    45: ['Fog', '\ud83c\udf2b\ufe0f'],
    48: ['Freezing fog', '\ud83c\udf2b\ufe0f'],
    51: ['Light drizzle', '\ud83c\udf26\ufe0f'],
    53: ['Drizzle', '\ud83c\udf26\ufe0f'],
    55: ['Heavy drizzle', '\ud83c\udf26\ufe0f'],
    56: ['Freezing drizzle', '\ud83c\udf28\ufe0f'],
    57: ['Freezing drizzle', '\ud83c\udf28\ufe0f'],
    61: ['Light rain', '\ud83c\udf27\ufe0f'],
    63: ['Rain', '\ud83c\udf27\ufe0f'],
    65: ['Heavy rain', '\ud83c\udf27\ufe0f'],
    66: ['Freezing rain', '\ud83c\udf28\ufe0f'],
    67: ['Freezing rain', '\ud83c\udf28\ufe0f'],
    71: ['Light snow', '\ud83c\udf28\ufe0f'],
    73: ['Snow', '\ud83c\udf28\ufe0f'],
    75: ['Heavy snow', '\u2744\ufe0f'],
    77: ['Snow grains', '\u2744\ufe0f'],
    80: ['Rain showers', '\ud83c\udf26\ufe0f'],
    81: ['Rain showers', '\ud83c\udf26\ufe0f'],
    82: ['Violent showers', '\u26c8\ufe0f'],
    85: ['Snow showers', '\ud83c\udf28\ufe0f'],
    86: ['Snow showers', '\ud83c\udf28\ufe0f'],
    95: ['Thunderstorm', '\u26c8\ufe0f'],
    96: ['Thunderstorm with hail', '\u26c8\ufe0f'],
    99: ['Thunderstorm with hail', '\u26c8\ufe0f'],
  }
  const entry = table[code]
  return entry ? { label: entry[0], glyph: entry[1] } : { label: 'Unknown', glyph: '\ud83c\udf21\ufe0f' }
}

/** A short weekday label for an ISO date, falling back to the date itself. */
export function weekday(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date)
}
