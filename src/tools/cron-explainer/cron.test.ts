import { describe, expect, it } from 'vitest'
import { buildCron, nextRuns, parseCron, parseField, type ScheduleSpec } from './cron'

const SPECS = {
  minute: { name: 'minute', min: 0, max: 59 },
  hour: { name: 'hour', min: 0, max: 23 },
  dom: { name: 'day of month', min: 1, max: 31 },
  month: { name: 'month', min: 1, max: 12, names: [] as string[] },
  dow: { name: 'day of week', min: 0, max: 6, names: [] as string[] },
}

describe('parseField', () => {
  it('expands wildcards, ranges, steps and lists', () => {
    expect(parseField('*', SPECS.minute).values).toHaveLength(60)
    expect(parseField('*/15', SPECS.minute).values).toEqual([0, 15, 30, 45])
    expect(parseField('1-5', SPECS.dow).values).toEqual([1, 2, 3, 4, 5])
    expect(parseField('1,15,30', SPECS.minute).values).toEqual([1, 15, 30])
    expect(parseField('10-20/5', SPECS.minute).values).toEqual([10, 15, 20])
  })

  it('accepts single values', () => {
    expect(parseField('30', SPECS.minute).values).toEqual([30])
  })

  it('rejects out-of-range and malformed fields', () => {
    expect(() => parseField('60', SPECS.minute)).toThrow()
    expect(() => parseField('1/0', SPECS.minute)).toThrow()
    expect(() => parseField('a', SPECS.minute)).toThrow()
    expect(() => parseField('1,,2', SPECS.minute)).toThrow()
  })
})

describe('parseCron', () => {
  it('describes a common schedule', () => {
    const result = parseCron('0 9 * * 1-5')
    expect(result.valid).toBe(true)
    expect(result.description).toContain('0')
    expect(result.description).toContain('Monday, Tuesday')
  })

  it('rejects the wrong number of fields', () => {
    const result = parseCron('* * *')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('Expected 5 fields')
  })

  it('reports an empty expression', () => {
    expect(parseCron('  ').valid).toBe(false)
  })

  it('gives a human phrase for plain wildcards', () => {
    expect(parseCron('* * * * *').description).toBe('every minute · every hour · every day · every month · every day of the week')
  })
})

describe('nextRuns', () => {
  it('finds the next daily midnight', () => {
    const fields = parseCron('0 0 * * *').fields
    const from = new Date('2024-05-01T10:30:00')
    const next = nextRuns(fields, from, 3)
    expect(next).toHaveLength(3)
    expect(next[0].getHours()).toBe(0)
    expect(next[0].getMinutes()).toBe(0)
    expect(next[2].getTime() - next[0].getTime()).toBe(2 * 24 * 60 * 60 * 1000)
  })

  it('respects weekdays-only schedules', () => {
    const fields = parseCron('0 9 * * 1-5').fields
    const next = nextRuns(fields, new Date('2024-05-03T12:00:00'), 4) // Friday afternoon
    expect(next.map((date) => date.getDay())).toEqual([1, 2, 3, 4]) // Mon-Thu
  })
})

describe('buildCron', () => {
  const base: ScheduleSpec = { frequency: 'daily', minute: 30, hour: 8, weekdays: [1], dayOfMonth: 1 }

  it('builds each frequency', () => {
    expect(buildCron({ ...base, frequency: 'minutely' })).toBe('* * * * *')
    expect(buildCron({ ...base, frequency: 'hourly' })).toBe('30 * * * *')
    expect(buildCron({ ...base, frequency: 'daily' })).toBe('30 8 * * *')
    expect(buildCron({ ...base, frequency: 'monthly', dayOfMonth: 15 })).toBe('30 8 15 * *')
  })

  it('lists weekdays sorted and de-duplicated', () => {
    expect(buildCron({ ...base, frequency: 'weekly', weekdays: [5, 1, 1, 3] })).toBe('30 8 * * 1,3,5')
    expect(buildCron({ ...base, frequency: 'weekly', weekdays: [] })).toBe('30 8 * * *')
  })

  it('clamps out-of-range values', () => {
    expect(buildCron({ ...base, frequency: 'daily', minute: 99, hour: -5 })).toBe('59 0 * * *')
    expect(buildCron({ ...base, frequency: 'monthly', dayOfMonth: 99 })).toBe('30 8 31 * *')
  })

  it('produces expressions the parser accepts', () => {
    const expressions = ['minutely', 'hourly', 'daily', 'weekly', 'monthly'].map((frequency) =>
      buildCron({ ...base, frequency: frequency as ScheduleSpec['frequency'] }),
    )
    for (const expression of expressions) {
      expect(parseCron(expression).valid).toBe(true)
    }
  })
})

