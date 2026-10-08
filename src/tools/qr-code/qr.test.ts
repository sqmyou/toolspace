import { describe, expect, it } from 'vitest'
import { buildMatrix, QrError, toSvg, toUtf8Bytes } from './qr'

describe('toUtf8Bytes', () => {
  it('encodes ASCII as single bytes', () => {
    expect(toUtf8Bytes('abc')).toEqual([97, 98, 99])
  })

  it('encodes two-byte characters', () => {
    expect(toUtf8Bytes('é')).toEqual([0xc3, 0xa9])
  })

  it('encodes three-byte characters', () => {
    expect(toUtf8Bytes('世')).toEqual([0xe4, 0xb8, 0x96])
  })

  it('encodes astral characters as four bytes', () => {
    expect(toUtf8Bytes('🚀')).toEqual([0xf0, 0x9f, 0x9a, 0x80])
  })

  it('returns an empty array for empty input', () => {
    expect(toUtf8Bytes('')).toEqual([])
  })
})

describe('buildMatrix', () => {
  it('rejects empty input', async () => {
    await expect(buildMatrix('')).rejects.toThrow(QrError)
  })

  it('builds a square matrix of valid size', async () => {
    const m = await buildMatrix('hello world')
    expect(m.size).toBeGreaterThanOrEqual(21)
    expect(m.dark).toHaveLength(m.size)
    for (const row of m.dark) expect(row).toHaveLength(m.size)
  })

  it('marks the top-left finder pattern as dark', async () => {
    const m = await buildMatrix('hello')
    expect(m.dark[0][0]).toBe(true)
    expect(m.dark[0][m.size - 1]).toBe(true)
  })

  it('is deterministic for the same input', async () => {
    const a = await buildMatrix('same text', 'M')
    const b = await buildMatrix('same text', 'M')
    expect(a.dark).toEqual(b.dark)
  })

  it('produces different output for different input', async () => {
    const a = await buildMatrix('one')
    const b = await buildMatrix('two')
    expect(a.dark).not.toEqual(b.dark)
  })

  it('groups more data into a bigger matrix', async () => {
    const small = await buildMatrix('a')
    const large = await buildMatrix('a'.repeat(400))
    expect(large.size).toBeGreaterThan(small.size)
  })

  it('handles non-ASCII text', async () => {
    const m = await buildMatrix('héllo — 世界 🚀')
    expect(m.size).toBeGreaterThanOrEqual(21)
  })

  it('respects the error correction level', async () => {
    const low = await buildMatrix('a'.repeat(100), 'L')
    const high = await buildMatrix('a'.repeat(100), 'H')
    expect(high.size).toBeGreaterThanOrEqual(low.size)
  })
})

describe('toSvg', () => {
  it('emits a scalable svg with correct viewBox', async () => {
    const m = await buildMatrix('hello')
    const svg = toSvg(m, { margin: 2 })
    const dimension = m.size + 4
    expect(svg).toContain(`viewBox="0 0 ${dimension} ${dimension}"`)
    expect(svg).toContain('<path')
    expect(svg.trim().endsWith('</svg>')).toBe(true)
  })

  it('honours custom colours', async () => {
    const m = await buildMatrix('hello')
    const svg = toSvg(m, { dark: '#123456', light: '#abcdef' })
    expect(svg).toContain('#123456')
    expect(svg).toContain('#abcdef')
  })

  it('writes one path command per dark module', async () => {
    const m = await buildMatrix('hello')
    const darkCount = m.dark.flat().filter(Boolean).length
    const svg = toSvg(m)
    expect(svg.match(/M\d+ \d+h1v1h-1z/g)?.length).toBe(darkCount)
  })
})
