import { describe, expect, it } from 'vitest'
import {
  averageCps,
  bestCps,
  clicksInWindow,
  consistency,
  cpsInWindow,
  extremes,
  intervals,
  mean,
  stdDev,
} from './click'

describe('clicksInWindow', () => {
  it('counts only clicks in the trailing half-open window', () => {
    // Window is (1000, 2000]: a click at exactly 1000 is out, 2000 is in.
    expect(clicksInWindow([0, 500, 1000, 1500, 2000, 2500], 1000, 2000)).toBe(2)
  })

  it('is zero for an empty history', () => {
    expect(clicksInWindow([], 1000, 2000)).toBe(0)
  })
})

describe('cpsInWindow', () => {
  it('converts a count to a per-second rate', () => {
    expect(cpsInWindow([100, 300, 500, 700, 900], 1000, 1000)).toBe(5)
  })

  it('scales for shorter windows', () => {
    // Three clicks in a 500ms window is six per second.
    expect(cpsInWindow([600, 700, 800], 500, 1000)).toBe(6)
  })

  it('guards against a zero window', () => {
    expect(cpsInWindow([1, 2], 0, 10)).toBe(0)
  })
})

describe('bestCps', () => {
  it('finds the fastest full second', () => {
    // Seven clicks packed into the first 600ms, then nothing: the best second
    // is 7 even though the average over the whole run is lower.
    const times = [0, 90, 180, 270, 360, 450, 540]
    expect(bestCps(times, 1000)).toBe(7)
  })

  it('is zero with no clicks', () => {
    expect(bestCps([], 1000)).toBe(0)
  })
})

describe('averageCps', () => {
  it('uses the window as a floor so a tiny run is not inflated', () => {
    // Two clicks 10ms apart would be 100 CPS if we divided by the span.
    expect(averageCps([0, 10], 1000)).toBe(2)
  })

  it('averages over the real span once it exceeds the window', () => {
    // 11 clicks spanning 2000ms → 5.5 CPS.
    const times = Array.from({ length: 11 }, (_, i) => i * 200)
    expect(averageCps(times, 1000)).toBeCloseTo(5.5, 5)
  })

  it('is zero with no clicks', () => {
    expect(averageCps([], 1000)).toBe(0)
  })
})

describe('intervals', () => {
  it('returns the gaps between clicks', () => {
    expect(intervals([0, 100, 350, 400])).toEqual([100, 250, 50])
  })

  it('returns nothing for fewer than two clicks', () => {
    expect(intervals([5])).toEqual([])
    expect(intervals([])).toEqual([])
  })
})

describe('mean and stdDev', () => {
  it('compute the average', () => {
    expect(mean([2, 4, 6])).toBe(4)
  })

  it('compute the population standard deviation', () => {
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2, 6)
  })

  it('are zero for an empty list', () => {
    expect(mean([])).toBe(0)
    expect(stdDev([])).toBe(0)
  })
})

describe('consistency', () => {
  it('scores a perfectly even run at 100', () => {
    expect(consistency([100, 100, 100, 100])).toBe(100)
  })

  it('scores an erratic run lower', () => {
    const steady = consistency([100, 100, 100, 100])
    const erratic = consistency([20, 400, 30, 500])
    expect(erratic).toBeLessThan(steady)
    expect(erratic).toBeGreaterThan(0)
    expect(erratic).toBeLessThan(100)
  })

  it('needs at least two gaps', () => {
    expect(consistency([100])).toBe(0)
    expect(consistency([])).toBe(0)
  })
})

describe('extremes', () => {
  it('finds the shortest and longest gap', () => {
    expect(extremes([120, 80, 300, 90])).toEqual({ shortest: 80, longest: 300 })
  })

  it('is zero for an empty list', () => {
    expect(extremes([])).toEqual({ shortest: 0, longest: 0 })
  })
})
