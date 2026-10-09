import { describe, expect, it } from 'vitest'
import { flip, flipMany, longestStreak, tally, uniformInt } from './coin'

/** A deterministic byte stream, so the tests never depend on real entropy. */
function counter(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

describe('uniformInt', () => {
  it('rejects out-of-range values instead of folding them', () => {
    // The pool holds 0..65535. For max=3 the largest multiple of 3 below the
    // pool is 65535, so the top value (65535) is rejected: folding it with a
    // modulo would land on 0 and make that outcome more likely than the others.
    // The next draw is used instead.
    expect(uniformInt(3, counter([0xffff, 1]))).toBe(1)
    // 65534 is in range and divides to 2.
    expect(uniformInt(3, counter([0xfffe]))).toBe(2)
    // For max=2 the pool divides evenly, so nothing needs rejecting.
    expect(uniformInt(2, counter([0xffff]))).toBe(1)
  })

  it('always returns a value inside the range', () => {
    const source = counter([0, 1, 2, 3, 4, 5, 6, 7, 0xffff, 0xfffe])
    for (let i = 0; i < 200; i += 1) {
      const value = uniformInt(6, source)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(6)
    }
  })

  it('is uniform over many deterministic draws', () => {
    let seed = 12345
    const source = () => (seed = (seed * 1103515245 + 12345) & 0xffff)
    const counts = new Array(5).fill(0)
    for (let i = 0; i < 5000; i += 1) counts[uniformInt(5, source)] += 1
    for (const count of counts) expect(count).toBeGreaterThan(800)
  })

  it('rejects a non-positive or fractional max', () => {
    expect(() => uniformInt(0, counter([0]))).toThrow()
    expect(() => uniformInt(2.5, counter([0]))).toThrow()
  })

  it('returns zero when there is only one outcome', () => {
    expect(uniformInt(1, counter([9]))).toBe(0)
  })
})

describe('flip', () => {
  it('maps the draw onto a side', () => {
    expect(flip(counter([0]))).toBe('heads')
    expect(flip(counter([1]))).toBe('tails')
  })

  it('produces both sides over a run', () => {
    let seed = 7
    const source = () => (seed = (seed * 48271) % 0xffff)
    const sides = flipMany(400, source)
    expect(new Set(sides).size).toBe(2)
  })
})

describe('flipMany', () => {
  it('returns the requested number of flips', () => {
    expect(flipMany(5, counter([0, 1]))).toHaveLength(5)
  })

  it('returns nothing for a zero count', () => {
    expect(flipMany(0, counter([0]))).toEqual([])
  })

  it('rejects a negative or fractional count', () => {
    expect(() => flipMany(-1, counter([0]))).toThrow()
    expect(() => flipMany(1.5, counter([0]))).toThrow()
  })
})

describe('tally', () => {
  it('counts heads and tails', () => {
    expect(tally(['heads', 'heads', 'tails'])).toEqual({ heads: 2, tails: 1, total: 3 })
  })

  it('is all zeroes for an empty run', () => {
    expect(tally([])).toEqual({ heads: 0, tails: 0, total: 0 })
  })
})

describe('longestStreak', () => {
  it('finds the longest run and which side made it', () => {
    expect(longestStreak(['heads', 'tails', 'tails', 'tails', 'heads'])).toEqual({ side: 'tails', length: 3 })
  })

  it('reports nothing for an empty run', () => {
    expect(longestStreak([])).toEqual({ side: null, length: 0 })
  })

  it('handles a single flip', () => {
    expect(longestStreak(['heads'])).toEqual({ side: 'heads', length: 1 })
  })
})
