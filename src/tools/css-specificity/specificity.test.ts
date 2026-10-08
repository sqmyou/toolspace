import { describe, expect, it } from 'vitest'
import { analyse, compareSpecificity, formatSpecificity, scoreSelectorList, splitSelectorList, specificityOf } from './specificity'

const spec = (selector: string) => specificityOf(selector).specificity

describe('splitSelectorList', () => {
  it('splits on top-level commas', () => {
    expect(splitSelectorList('a, b')).toEqual(['a', 'b'])
  })

  it('keeps commas inside functional pseudos and attributes', () => {
    expect(splitSelectorList(':is(a, b), .c')).toEqual([':is(a, b)', '.c'])
    expect(splitSelectorList('[data-x="a,b"]')).toEqual(['[data-x="a,b"]'])
  })
})

describe('specificityOf', () => {
  it('scores a type selector', () => {
    expect(spec('div')).toEqual({ ids: 0, classes: 0, elements: 1 })
  })

  it('scores a class', () => {
    expect(spec('.btn')).toEqual({ ids: 0, classes: 1, elements: 0 })
  })

  it('scores an id', () => {
    expect(spec('#app')).toEqual({ ids: 1, classes: 0, elements: 0 })
  })

  it('scores a compound selector', () => {
    expect(spec('div#app.btn')).toEqual({ ids: 1, classes: 1, elements: 1 })
  })

  it('ignores the universal selector', () => {
    expect(spec('*')).toEqual({ ids: 0, classes: 0, elements: 0 })
  })

  it('scores descendant and child combinators', () => {
    expect(spec('ul li a')).toEqual({ ids: 0, classes: 0, elements: 3 })
    expect(spec('ul > li')).toEqual({ ids: 0, classes: 0, elements: 2 })
  })

  it('counts attribute selectors as classes', () => {
    expect(spec('[type="text"]')).toEqual({ ids: 0, classes: 1, elements: 0 })
  })

  it('counts pseudo-classes as classes and pseudo-elements as elements', () => {
    expect(spec('a:hover')).toEqual({ ids: 0, classes: 1, elements: 1 })
    expect(spec('p::before')).toEqual({ ids: 0, classes: 0, elements: 2 })
  })

  it('takes the most specific argument of :not() and :is()', () => {
    expect(spec(':not(.a)')).toEqual({ ids: 0, classes: 1, elements: 0 })
    expect(spec(':is(#a, .b)')).toEqual({ ids: 1, classes: 0, elements: 0 })
  })

  it('gives :where() zero specificity', () => {
    expect(spec(':where(#a, .b)')).toEqual({ ids: 0, classes: 0, elements: 0 })
    expect(spec('div:where(.b)')).toEqual({ ids: 0, classes: 0, elements: 1 })
  })

  it('flags !important', () => {
    expect(specificityOf('a !important').important).toBe(true)
    expect(specificityOf('a').important).toBe(false)
  })
})

describe('compareSpecificity', () => {
  it('orders ids over classes over elements', () => {
    expect(compareSpecificity({ ids: 1, classes: 0, elements: 0 }, { ids: 0, classes: 9, elements: 9 })).toBeGreaterThan(0)
    expect(compareSpecificity({ ids: 0, classes: 1, elements: 0 }, { ids: 0, classes: 0, elements: 9 })).toBeGreaterThan(0)
  })

  it('treats equal triples as equal', () => {
    expect(compareSpecificity({ ids: 1, classes: 2, elements: 3 }, { ids: 1, classes: 2, elements: 3 })).toBe(0)
  })
})

describe('formatSpecificity', () => {
  it('renders the classic triple', () => {
    expect(formatSpecificity({ ids: 1, classes: 2, elements: 3 })).toBe('(1, 2, 3)')
  })
})

describe('analyse', () => {
  it('finds the highest specificity and sorts the list', () => {
    const report = analyse('.a, #b, div')
    expect(formatSpecificity(report.max)).toBe('(1, 0, 0)')
    expect(report.sorted[0].selector).toBe('#b')
    expect(report.sorted[2].selector).toBe('div')
  })

  it('returns an empty report for blank input', () => {
    expect(scoreSelectorList('')).toEqual([])
    expect(analyse('').max).toEqual({ ids: 0, classes: 0, elements: 0 })
  })
})
