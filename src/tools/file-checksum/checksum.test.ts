import { describe, expect, it } from 'vitest'
import { checksumText, crc32Text, shaText } from './checksum'

describe('crc32', () => {
  it('matches the standard vector', () => {
    expect(crc32Text('123456789')).toBe('cbf43926')
  })

  it('is zero-padded to eight characters', () => {
    expect(crc32Text('')).toBe('00000000')
  })
})

describe('sha', () => {
  it('matches known digests', async () => {
    expect(await shaText('SHA-256', 'abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    expect(await shaText('SHA-1', 'abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
  })
})

describe('checksumText', () => {
  it('reports size and all digests', async () => {
    const result = await checksumText('hello')
    expect(result.size).toBe(5)
    expect(result.crc32).toMatch(/^[0-9a-f]{8}$/)
    expect(result.sha256).toHaveLength(64)
    expect(result.sha512).toHaveLength(128)
  })
})
