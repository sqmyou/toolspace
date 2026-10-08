import { describe, expect, it } from 'vitest'
import { generateLorem, paragraph, sentence, wordsFor } from './lorem'

/** Deterministic RNG so output is reproducible in tests. */
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

describe('wordsFor', () => {
  it('returns distinct banks', () => {
    expect(wordsFor('classic')).toContain('lorem')
    expect(wordsFor('software')).toContain('deploy')
  })
})

describe('sentence', () => {
  it('starts with a capital and ends with a period', () => {
    const text = sentence(seeded(1), wordsFor('classic'), 3, 3)
    expect(text[0]).toBe(text[0].toUpperCase())
    expect(text.endsWith('.')).toBe(true)
    expect(text.split(' ').length).toBe(3)
  })
})

describe('generateLorem', () => {
  it('generates the requested number of words', () => {
    const words = generateLorem({ source: 'classic', unit: 'words', count: 12, classicOpening: false, rng: seeded(2) })
    expect(words.split(' ').length).toBe(12)
  })

  it('generates paragraphs separated by blank lines', () => {
    const text = generateLorem({ source: 'software', unit: 'paragraphs', count: 3, classicOpening: false, rng: seeded(3) })
    expect(text.split('\n\n').length).toBe(3)
  })

  it('prepends the classic opening when asked', () => {
    const text = generateLorem({ source: 'classic', unit: 'sentences', count: 2, classicOpening: true, rng: seeded(4) })
    expect(text.startsWith('Lorem ipsum dolor sit amet')).toBe(true)
  })

  it('clamps the count', () => {
    const text = generateLorem({ source: 'classic', unit: 'words', count: 0, classicOpening: false, rng: seeded(5) })
    expect(text.split(' ').length).toBe(1)
  })
})

describe('paragraph', () => {
  it('joins the requested number of sentences', () => {
    const text = paragraph(seeded(6), wordsFor('classic'), 2)
    expect(text.match(/\./g)?.length).toBe(2)
  })
})
