import { describe, expect, it } from 'vitest'
import { compile, explain, highlight, runRegex } from './regex'

describe('runRegex', () => {
  it('finds all global matches with indices', () => {
    const { matches } = runRegex('\\d+', 'g', 'a1 b22 c333')
    expect(matches.map((m) => m.value)).toEqual(['1', '22', '333'])
    expect(matches[1].index).toBe(4)
  })

  it('reports capture groups and named groups', () => {
    const { matches } = runRegex('(?<year>\\d{4})-(\\d{2})', '', '2024-05')
    expect(matches[0].groups).toEqual(['2024', '05'])
    expect(matches[0].named.year).toBe('2024')
  })

  it('does not loop forever on zero-width matches', () => {
    const { matches } = runRegex('a*', 'g', 'bb')
    expect(matches.length).toBeLessThan(10)
  })

  it('returns an error for invalid patterns', () => {
    expect(runRegex('(', 'g', 'x').error).toBeTruthy()
  })
})

describe('compile', () => {
  it('does not duplicate the d flag', () => {
    const { regex } = compile('a', 'dgi')
    expect(regex?.flags.split('').filter((f) => f === 'd')).toHaveLength(1)
  })
})

describe('explain', () => {
  it('describes common constructs', () => {
    const tokens = explain('^\\d{3}[a-z]+$')
    const meanings = tokens.map((t) => t.meaning).join(' | ')
    expect(meanings).toContain('start of the string')
    expect(meanings).toContain('a digit')
    expect(meanings).toContain('exactly 3 times')
    expect(meanings).toContain('one of a-z')
    expect(meanings).toContain('one or more')
    expect(meanings).toContain('end of the string')
  })

  it('describes named groups', () => {
    const tokens = explain('(?<id>\\d+)')
    expect(tokens.some((t) => t.meaning.includes('named group “id”'))).toBe(true)
  })
})

describe('highlight', () => {
  it('splits text into matched and unmatched runs', () => {
    const { matches } = runRegex('\\d+', 'g', 'a1b22')
    const parts = highlight('a1b22', matches)
    expect(parts).toEqual([
      { text: 'a', match: false },
      { text: '1', match: true },
      { text: 'b', match: false },
      { text: '22', match: true },
    ])
  })
})
