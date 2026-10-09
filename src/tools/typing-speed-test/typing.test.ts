import { describe, expect, it } from 'vitest'
import {
  buildText, characters, consistencyFrom, keystrokeStats, linearTrend, perSecondSeries, shuffled, speedChartSvg, weakKeys, type KeyEvent,
} from './typing'

function event(char: string | null, correct: boolean, at: number, expected?: string | null): KeyEvent {
  return { char, correct, at, expected }
}

describe('keystrokeStats', () => {
  it('counts a clean run', () => {
    const events = [event('a', true, 100), event('b', true, 200), event('c', true, 300)]
    const stats = keystrokeStats(events, 3, 60000)
    // 3 characters in a minute is 3/5 WPM.
    expect(stats.wpm).toBeCloseTo(0.6, 6)
    expect(stats.rawWpm).toBeCloseTo(0.6, 6)
    expect(stats.accuracy).toBe(100)
    expect(stats.cpm).toBeCloseTo(3, 6)
  })

  it('scores accuracy from keypresses, not final text', () => {
    const events = [
      event('a', true, 100),
      event('x', false, 200),
      event(null, true, 250), // backspace is neither correct nor incorrect
      event('b', true, 300),
    ]
    const stats = keystrokeStats(events, 2, 60000)
    expect(stats.backspaces).toBe(1)
    expect(stats.incorrect).toBe(1)
    expect(stats.correct).toBe(2)
    // 2 correct of 3 typed keypresses.
    expect(stats.accuracy).toBeCloseTo((2 / 3) * 100, 6)
  })

  it('separates net WPM from raw WPM when mistakes were fixed', () => {
    // Five correct presses, one wrong and fixed: net length is 5, raw counts 5.
    const events = [
      event('a', true, 100),
      event('b', true, 200),
      event('x', false, 300),
      event(null, true, 350),
      event('c', true, 400),
      event('d', true, 500),
      event('e', true, 600),
    ]
    const stats = keystrokeStats(events, 5, 60000)
    expect(stats.wpm).toBeCloseTo(1, 6)
    expect(stats.rawWpm).toBeCloseTo(5 / 5, 6)
  })

  it('is zero for an empty run with no duration', () => {
    const stats = keystrokeStats([], 0, 0)
    expect(stats.wpm).toBe(0)
    expect(stats.accuracy).toBe(0)
  })

  it('reports a realistic minute-long run', () => {
    // 300 correct characters in 60s → 60 WPM.
    const events = Array.from({ length: 300 }, (_, i) => event('a', true, i * 200))
    const stats = keystrokeStats(events, 300, 60000)
    expect(stats.wpm).toBeCloseTo(60, 6)
  })
})

describe('buildText', () => {
  it('joins the requested number of words', () => {
    expect(buildText(['the', 'quick', 'fox'], 3)).toBe('the quick fox')
  })

  it('wraps the bank when more words are asked for', () => {
    expect(buildText(['a', 'b'], 5).split(' ')).toHaveLength(5)
  })

  it('avoids an immediate repeat where it can', () => {
    // Index 0 and 2 would both be 'a' if we simply cycled; the repeat guard
    // keeps adjacent words different.
    const text = buildText(['a', 'b'], 4).split(' ')
    for (let i = 1; i < text.length; i += 1) expect(text[i]).not.toBe(text[i - 1])
  })

  it('is empty for an empty bank or a zero count', () => {
    expect(buildText([], 10)).toBe('')
    expect(buildText(['a'], 0)).toBe('')
  })
})

describe('shuffled', () => {
  it('keeps every element exactly once', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const result = shuffled(input)
    expect([...result].sort((a, b) => a - b)).toEqual(input)
  })

  it('does not mutate the input', () => {
    const input = [1, 2, 3]
    shuffled(input)
    expect(input).toEqual([1, 2, 3])
  })
})

describe('characters', () => {
  it('splits into code points, not UTF-16 units', () => {
    expect(characters('a😀b')).toEqual(['a', '😀', 'b'])
  })
})

describe('perSecondSeries', () => {
  it('scores each second as correct characters times twelve', () => {
    // Five correct characters land in the first second, none in the second.
    const events = [
      event('a', true, 100), event('b', true, 200), event('c', true, 300),
      event('d', true, 400), event('e', true, 500),
      event('f', true, 1500),
    ]
    const series = perSecondSeries(events, 3000)
    expect(series.map((s) => s.second)).toEqual([1, 2, 3])
    expect(series[0].wpm).toBe(60)
    expect(series[1].wpm).toBe(12)
    expect(series[2].wpm).toBe(0)
  })

  it('counts errors and ignores backspaces per second', () => {
    const events = [
      event('x', false, 100), event('a', true, 200), event(null, true, 250),
    ]
    const series = perSecondSeries(events, 1000)
    expect(series[0].errors).toBe(1)
    expect(series[0].wpm).toBe(12)
  })

  it('returns nothing for a sub-second run', () => {
    expect(perSecondSeries([event('a', true, 400)], 800)).toEqual([])
  })
})

describe('weakKeys', () => {
  it('ranks by miss rate then by count', () => {
    const events = [
      event('x', false, 1, 'q'), event('x', false, 2, 'q'), event('x', false, 3, 'q'),
      event('x', false, 1, 'z'), event('z', true, 2, 'z'), event('z', true, 3, 'z'), event('z', true, 4, 'z'),
    ]
    const weak = weakKeys(events)
    expect(weak[0].char).toBe('q')
    expect(weak[0].rate).toBe(1)
    expect(weak[1].char).toBe('z')
    expect(weak[1].rate).toBeCloseTo(0.25, 6)
  })

  it('ignores keys below the attempt threshold and the space bar', () => {
    const events = [event('x', false, 1, 'q'), event('x', false, 2, ' '), event('x', false, 3, ' ')]
    expect(weakKeys(events, 3)).toEqual([])
  })

  it('ignores correct presses and backspaces', () => {
    const events = [event('q', true, 1, 'q'), event(null, true, 2, 'q'), event('q', true, 3, 'q')]
    expect(weakKeys(events, 1)).toEqual([])
  })
})

describe('linearTrend', () => {
  it('fits a rising line', () => {
    expect(linearTrend([0, 10, 20, 30])).toEqual([0, 10, 20, 30])
  })

  it('fits a falling line', () => {
    expect(linearTrend([40, 30, 20, 10])).toEqual([40, 30, 20, 10])
  })

  it('flattens a single sample and handles an empty input', () => {
    expect(linearTrend([7])).toEqual([7])
    expect(linearTrend([])).toEqual([])
  })
})

describe('consistencyFrom', () => {
  it('reads 100 for perfectly even gaps', () => {
    expect(consistencyFrom([100, 100, 100, 100, 100]).score).toBe(100)
  })

  it('reads 0 for too few samples', () => {
    expect(consistencyFrom([100, 100, 100, 100]).score).toBe(0)
  })

  it('lands between the extremes for a ragged run', () => {
    const score = consistencyFrom([80, 120, 90, 110, 95, 105]).score
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(100)
  })
})

describe('speedChartSvg', () => {
  const samples = (ws: number[]) => ws.map((wpm, index) => ({ second: index + 1, wpm }))

  it('needs at least two seconds to draw', () => {
    expect(speedChartSvg([])).toBe('')
    expect(speedChartSvg(samples([60]))).toBe('')
  })

  it('draws a line, an area, a trend and one dot per second', () => {
    const svg = speedChartSvg(samples([40, 50, 60, 55]))
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('ts-type-chart__line')
    expect(svg).toContain('ts-type-chart__area')
    expect(svg).toContain('ts-type-chart__trend')
    expect(svg.match(/<circle/g)).toHaveLength(4)
    expect(svg.match(/<rect/g)).toHaveLength(4)
    expect(svg).toContain('aria-label="Words per minute across 4 seconds"')
  })

  it('keeps every dot inside the viewbox for a flat run', () => {
    const svg = speedChartSvg(samples([0, 0, 0]), 640, 160)
    const coords = [...svg.matchAll(/(?:cx|cy)="([-\d.]+)"/g)].map((match) => Number(match[1]))
    expect(coords.every((value) => value >= 0 && value <= 640)).toBe(true)
  })

  it('never emits a script tag even for a hostile sample', () => {
    const svg = speedChartSvg(samples([1e9, 5]))
    expect(svg).not.toContain('<script')
    expect(svg).toContain('viewBox')
  })
})

