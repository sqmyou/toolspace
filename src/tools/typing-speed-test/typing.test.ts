import { describe, expect, it } from 'vitest'
import { buildText, characters, consistencyOf, keystrokeStats, shuffled, type KeyEvent } from './typing'

function event(char: string | null, correct: boolean, at: number): KeyEvent {
  return { char, correct, at }
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

describe('consistencyOf', () => {
  it('scores even gaps at 100', () => {
    expect(consistencyOf([100, 100, 100], 100)).toBe(100)
  })

  it('scores spiky gaps lower but above zero', () => {
    const spiky = consistencyOf([20, 400, 30, 500], 237.5)
    expect(spiky).toBeGreaterThan(0)
    expect(spiky).toBeLessThan(100)
  })

  it('needs at least two gaps', () => {
    expect(consistencyOf([100], 100)).toBe(0)
    expect(consistencyOf([], 0)).toBe(0)
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
