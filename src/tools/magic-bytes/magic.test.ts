import { describe, expect, it } from 'vitest'
import { detect, detectOne, looksLikeText, parseHex, preview, SIGNATURES, toHex } from './magic'

const png = parseHex('89504e470d0a1a0a0000000d49484452')
const gif = parseHex('47494638396101000100')

describe('parseHex', () => {
  it('reads plain hex pairs', () => {
    expect([...parseHex('8950 4e47')]).toEqual([0x89, 0x50, 0x4e, 0x47])
    expect([...parseHex('0x89,0x50')]).toEqual([0x89, 0x50])
  })

  it('returns nothing for empty input', () => {
    expect(parseHex('').length).toBe(0)
  })

  it('rejects bad input', () => {
    expect(() => parseHex('zz')).toThrow()
    expect(() => parseHex('abc')).toThrow(/even number/)
  })
})

describe('detect', () => {
  it('finds a PNG', () => {
    expect(detectOne(png)).toMatchObject({ name: 'PNG image', mime: 'image/png', extension: 'png' })
  })

  it('finds a GIF', () => {
    expect(detectOne(gif)?.extension).toBe('gif')
  })

  it('checks the container tail for RIFF formats', () => {
    const webp = parseHex('524946460000000057454250')
    const wav = parseHex('524946460000000057415645')
    expect(detectOne(webp)?.extension).toBe('webp')
    expect(detectOne(wav)?.extension).toBe('wav')
  })

  it('checks offset 4 for MP4', () => {
    const mp4 = parseHex('00000018667479706d703432')
    expect(detectOne(mp4)?.extension).toBe('mp4')
  })

  it('checks offset 257 for TAR', () => {
    const header = new Uint8Array(262)
    header.set([0x75, 0x73, 0x74, 0x61, 0x72], 257)
    expect(detectOne(header)?.extension).toBe('tar')
  })

  it('returns every match, most specific first', () => {
    const matches = detect(png)
    expect(matches.length).toBeGreaterThan(0)
    for (let i = 1; i < matches.length; i++) expect(matches[i - 1].confidence).toBeGreaterThanOrEqual(matches[i].confidence)
  })

  it('returns nothing for an empty or unknown buffer', () => {
    expect(detect(new Uint8Array())).toEqual([])
    expect(detectOne(parseHex('0102030405'))).toBeNull()
  })
})

describe('looksLikeText', () => {
  it('accepts ordinary text', () => {
    expect(looksLikeText(new TextEncoder().encode('hello world'))).toBe(true)
  })

  it('rejects a null byte', () => {
    expect(looksLikeText(new Uint8Array([0x68, 0x00, 0x69]))).toBe(false)
  })

  it('rejects a buffer full of control bytes', () => {
    expect(looksLikeText(new Uint8Array([0x01, 0x02, 0x03, 0x04]))).toBe(false)
  })

  it('rejects an empty buffer', () => {
    expect(looksLikeText(new Uint8Array())).toBe(false)
  })
})

describe('toHex and preview', () => {
  it('formats hex pairs', () => {
    expect(toHex(parseHex('89504e47'))).toBe('89 50 4e 47')
  })

  it('limits the length', () => {
    expect(toHex(png, 4)).toBe('89 50 4e 47')
  })

  it('shows printable characters and dots', () => {
    expect(preview(parseHex('41420043'))).toBe('AB.C')
  })
})

describe('the signature table', () => {
  it('has unique names', () => {
    const names = SIGNATURES.map((signature) => signature.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('gives every signature a mime type', () => {
    for (const signature of SIGNATURES) expect(signature.mime).toMatch(/\//)
  })

  it('has no wildcard-only pattern', () => {
    for (const signature of SIGNATURES) expect(signature.bytes.some((byte) => byte !== -1)).toBe(true)
  })
})
