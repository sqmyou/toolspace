import { describe, expect, it } from 'vitest'
import { describeCode, forecastUrl, geocodeUrl, parseForecast, parsePlace, weekday } from './weather'

describe('url builders', () => {
  it('builds a geocoding url', () => {
    expect(geocodeUrl('New York')).toBe(
      'https://geocoding-api.open-meteo.com/v1/search?name=New+York&count=1&language=en&format=json',
    )
  })

  it('builds a forecast url with the coordinates', () => {
    const url = forecastUrl(52.52, 13.41)
    expect(url).toContain('https://api.open-meteo.com/v1/forecast?')
    expect(url).toContain('latitude=52.52')
    expect(url).toContain('longitude=13.41')
    expect(url).toContain('timezone=auto')
  })
})

describe('parsePlace', () => {
  it('reads the first result', () => {
    const place = parsePlace({
      results: [
        { name: 'Berlin', country: 'Germany', admin1: 'Berlin', latitude: 52.52, longitude: 13.41, timezone: 'Europe/Berlin' },
        { name: 'Berlin', country: 'United States', latitude: 1, longitude: 2 },
      ],
    })
    expect(place).toMatchObject({ name: 'Berlin', country: 'Germany', latitude: 52.52, timezone: 'Europe/Berlin' })
  })

  it('returns null with no results or a malformed payload', () => {
    expect(parsePlace({ results: [] })).toBeNull()
    expect(parsePlace({})).toBeNull()
    expect(parsePlace(null)).toBeNull()
  })
})

describe('parseForecast', () => {
  it('reads the current conditions, daily arrays and units', () => {
    const forecast = parseForecast({
      current_units: { temperature_2m: '\u00b0C', wind_speed_10m: 'km/h' },
      current: { temperature_2m: 14.2, apparent_temperature: 12.8, relative_humidity_2m: 71, wind_speed_10m: 9.4, weather_code: 2 },
      daily: {
        time: ['2026-10-09', '2026-10-10'],
        weather_code: [2, 61],
        temperature_2m_max: [17.1, 15.0],
        temperature_2m_min: [9.0, 8.2],
        precipitation_probability_max: [10, 80],
      },
    })
    expect(forecast.current).toEqual({ temperature: 14.2, apparent: 12.8, humidity: 71, wind: 9.4, code: 2 })
    expect(forecast.days).toHaveLength(2)
    expect(forecast.days[1]).toMatchObject({ code: 61, max: 15.0, min: 8.2, precipitation: 80 })
    expect(forecast.units.temperature).toBe('\u00b0C')
  })

  it('survives a malformed payload', () => {
    const forecast = parseForecast(null)
    expect(forecast.current).toBeNull()
    expect(forecast.days).toEqual([])
    expect(forecast.units.temperature).toBe('\u00b0C')
  })
})

describe('describeCode', () => {
  it('names the common codes', () => {
    expect(describeCode(0).label).toBe('Clear sky')
    expect(describeCode(61).label).toBe('Light rain')
    expect(describeCode(95).label).toBe('Thunderstorm')
  })

  it('falls back for an unknown code', () => {
    expect(describeCode(1234).label).toBe('Unknown')
  })
})

describe('weekday', () => {
  it('turns an iso date into a short weekday', () => {
    expect(weekday('2026-10-09')).toBe('Fri')
  })

  it('falls back to the input when the date is nonsense', () => {
    expect(weekday('not-a-date')).toBe('not-a-date')
  })
})
