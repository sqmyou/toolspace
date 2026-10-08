import { describe, expect, it } from 'vitest'
import { geometricMean, harmonicMean, kurtosis, mean, median, mode, outliers, parseNumbers, percentile, quartiles, skewness, standardDeviation, StatsError, sum, summarise, variance, zScores } from './stats'

const data = [2, 4, 4, 4, 5, 5, 7, 9]

describe('parseNumbers', () => {
  it('accepts any common separator', () => {
    expect(parseNumbers('1 2 3')).toEqual([1, 2, 3])
    expect(parseNumbers('1,2,3')).toEqual([1, 2, 3])
    expect(parseNumbers('1; 2\n3')).toEqual([1, 2, 3])
  })

  it('accepts decimals and negatives', () => {
    expect(parseNumbers('-1.5, 2.25')).toEqual([-1.5, 2.25])
  })

  it('rejects junk and empty input', () => {
    expect(() => parseNumbers('1 abc 3')).toThrow(StatsError)
    expect(() => parseNumbers('   ')).toThrow(StatsError)
  })
})

describe('mean / median / mode / sum', () => {
  it('computes the mean', () => {
    expect(mean(data)).toBe(5)
    expect(sum(data)).toBe(40)
  })

  it('computes the median for odd and even counts', () => {
    expect(median([1, 2, 3])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median(data)).toBe(4.5)
  })

  it('finds the mode, including ties', () => {
    expect(mode(data)).toEqual([4])
    expect(mode([1, 1, 2, 2, 3])).toEqual([1, 2])
    expect(mode([1, 2, 3])).toEqual([])
  })

  it('rejects empty input', () => {
    expect(() => mean([])).toThrow(StatsError)
    expect(() => median([])).toThrow(StatsError)
  })
})

describe('variance / standardDeviation', () => {
  it('separates sample and population', () => {
    // Population variance of 1..5 is 2, sample variance is 2.5.
    const values = [1, 2, 3, 4, 5]
    expect(variance(values, false)).toBe(2)
    expect(variance(values, true)).toBe(2.5)
  })

  it('computes the standard deviation', () => {
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9], false)).toBeCloseTo(2)
    expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9], true)).toBeCloseTo(2.13809, 4)
  })

  it('needs two values for a sample', () => {
    expect(() => variance([1], true)).toThrow(StatsError)
    expect(variance([1], false)).toBe(0)
  })
})

describe('percentile / quartiles / outliers', () => {
  it('interpolates between ranks', () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2.5)
    expect(percentile([1, 2, 3, 4], 25)).toBe(1.75)
    expect(percentile([1, 2, 3, 4], 0)).toBe(1)
    expect(percentile([1, 2, 3, 4], 100)).toBe(4)
  })

  it('rejects an out-of-range percentile', () => {
    expect(() => percentile([1, 2], 101)).toThrow(StatsError)
    expect(() => percentile([1, 2], -1)).toThrow(StatsError)
  })

  it('computes quartiles and the IQR', () => {
    const result = quartiles([1, 2, 3, 4, 5])
    expect(result.q1).toBe(2)
    expect(result.q2).toBe(3)
    expect(result.q3).toBe(4)
    expect(result.iqr).toBe(2)
  })

  it('finds outliers', () => {
    expect(outliers([1, 2, 3, 4, 5, 100])).toEqual([100])
    expect(outliers([1, 2, 3, 4, 5])).toEqual([])
  })
})

describe('shape statistics', () => {
  it('reports zero skew for a symmetric set', () => {
    expect(skewness([1, 2, 3, 4, 5])).toBeCloseTo(0)
  })

  it('reports positive skew for a right tail', () => {
    expect(skewness([1, 1, 1, 1, 10])).toBeGreaterThan(0)
  })

  it('reports zero kurtosis change for a flat set', () => {
    expect(Number.isFinite(kurtosis([1, 2, 3, 4, 5]))).toBe(true)
  })

  it('needs enough values', () => {
    expect(() => skewness([1, 2])).toThrow(StatsError)
    expect(() => kurtosis([1, 2, 3])).toThrow(StatsError)
  })
})

describe('geometricMean / harmonicMean', () => {
  it('computes both means', () => {
    expect(geometricMean([1, 4, 16])).toBe(4)
    expect(harmonicMean([1, 2, 4])).toBeCloseTo(12 / 7)
  })

  it('rejects values they cannot handle', () => {
    expect(() => geometricMean([1, -2])).toThrow(StatsError)
    expect(() => harmonicMean([1, 0])).toThrow(StatsError)
  })
})

describe('zScores', () => {
  it('centres the scores on zero', () => {
    const scores = zScores([1, 2, 3, 4, 5])
    expect(scores.reduce((total, value) => total + value, 0)).toBeCloseTo(0)
    expect(scores[4]).toBeGreaterThan(0)
  })

  it('returns zeroes when there is no spread', () => {
    expect(zScores([5, 5, 5])).toEqual([0, 0, 0])
  })
})

describe('summarise', () => {
  it('collects the whole picture', () => {
    const result = summarise(data)
    expect(result.count).toBe(8)
    expect(result.min).toBe(2)
    expect(result.max).toBe(9)
    expect(result.range).toBe(7)
    expect(result.median).toBe(4.5)
    expect(result.mode).toEqual([4])
    expect(result.quartiles.iqr).toBeCloseTo(1.5)
    expect(result.skewness).not.toBeNull()
    expect(result.kurtosis).not.toBeNull()
  })

  it('leaves advanced figures out when there is too little data', () => {
    const result = summarise([1, 2])
    expect(result.skewness).toBeNull()
    expect(result.kurtosis).toBeNull()
    expect(result.varianceSample).toBe(0.5)
  })

  it('skips means that need positive values', () => {
    expect(summarise([-1, 2, 3]).geometricMean).toBeNull()
    expect(summarise([0, 2, 3]).harmonicMean).toBeNull()
  })
})
