import { describe, expect, it } from 'vitest'
import { allCaesarShifts, atbash, caesar, caesarDecode, fromMorse, rot13, toMorse } from './cipher'

describe('caesar', () => {
  it('shifts letters and preserves case', () => {
    expect(caesar('abc', 1)).toBe('bcd')
    expect(caesar('AbC', 2)).toBe('CdE')
  })

  it('wraps around the alphabet', () => {
    expect(caesar('xyz', 3)).toBe('abc')
    expect(caesar('XYZ', 3)).toBe('ABC')
  })

  it('leaves non-letters alone', () => {
    expect(caesar('hi, there! 42', 1)).toBe('ij, uifsf! 42')
  })

  it('handles negative and large shifts', () => {
    expect(caesar('bcd', -1)).toBe('abc')
    expect(caesar('abc', 27)).toBe('bcd')
    expect(caesar('abc', -27)).toBe('zab')
  })

  it('decodes a shift back to the original', () => {
    expect(caesarDecode(caesar('attack at dawn', 7), 7)).toBe('attack at dawn')
  })
})

describe('rot13', () => {
  it('is its own inverse', () => {
    expect(rot13('Hello, World!')).toBe('Uryyb, Jbeyq!')
    expect(rot13(rot13('Hello, World!'))).toBe('Hello, World!')
  })
})

describe('atbash', () => {
  it('mirrors the alphabet', () => {
    expect(atbash('abc')).toBe('zyx')
    expect(atbash('AbC')).toBe('ZyX')
  })

  it('is its own inverse', () => {
    expect(atbash(atbash('secret'))).toBe('secret')
  })
})

describe('morse', () => {
  it('encodes letters, digits and punctuation', () => {
    expect(toMorse('SOS')).toBe('... --- ...')
    expect(toMorse('hi 42')).toBe('.... .. / ....- ..---')
  })

  it('separates words with a slash', () => {
    expect(toMorse('abc def')).toBe('.- -... -.-. / -.. . ..-.')
  })

  it('round-trips through the decoder', () => {
    expect(fromMorse(toMorse('hello world'))).toBe('hello world')
    expect(fromMorse(toMorse('sos 123'))).toBe('sos 123')
  })

  it('accepts sloppy word separators', () => {
    expect(fromMorse('.... .. / - .... . .-. .')).toBe('hi there')
    expect(fromMorse('.... ..   - .... . .-. .')).toBe('hi there')
    expect(fromMorse('.... .. | - .... . .-. .')).toBe('hi there')
  })

  it('marks unknown codes instead of dropping them', () => {
    expect(fromMorse('... --- ... ........')).toBe('sos?')
  })
})

describe('allCaesarShifts', () => {
  it('lists every shift except zero', () => {
    const shifts = allCaesarShifts('abc')
    expect(shifts).toHaveLength(25)
    expect(shifts[0]).toEqual({ shift: 1, text: 'bcd' })
    expect(shifts[24]).toEqual({ shift: 25, text: 'zab' })
  })
})
