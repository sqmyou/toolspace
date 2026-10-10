import { describe, expect, it } from 'vitest'
import {
  checksumBytes,
  checksumText,
  crc32Int,
  crc32Text,
  digestFor,
  identifyDigest,
  normalizeHex,
  parseExpectedLine,
  shaText,
  toHex,
  verify,
} from './checksum'

describe('crc32', () => {
  it('matches the standard vector', () => {
    expect(crc32Text('123456789')).toBe('cbf43926')
  })

  it('is zero-padded to eight characters', () => {
    expect(crc32Text('')).toBe('00000000')
  })

  it('treats bytes as raw, not UTF-8 text', () => {
    // 0xC0 is not 'À' as UTF-8 would encode it; the integer form proves it.
    expect(crc32Int(new Uint8Array([0xc0]))).toBe(0x49662d3d)
    expect(crc32Int(new Uint8Array([0xc3, 0x80]))).not.toBe(crc32Int(new Uint8Array([0xc0])))
  })
})

describe('sha', () => {
  it('matches known digests', async () => {
    expect(await shaText('SHA-256', 'abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    expect(await shaText('SHA-1', 'abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
  })

  it('hashes the empty string', async () => {
    expect(await shaText('SHA-256', '')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })
})

describe('checksumText', () => {
  it('reports size and all digests', async () => {
    const result = await checksumText('hello')
    expect(result.size).toBe(5)
    expect(result.crc32).toBe('3610a686')
    expect(result.sha1).toHaveLength(40)
    expect(result.sha256).toHaveLength(64)
    expect(result.sha384).toHaveLength(96)
    expect(result.sha512).toHaveLength(128)
  })

  it('counts UTF-8 bytes, not code points, in the size', async () => {
    // "é" is two UTF-8 bytes.
    const result = await checksumText('é')
    expect(result.size).toBe(2)
    expect(result.sha256).toBe(await shaText('SHA-256', 'é'))
  })

  it('hashes an empty byte array to the empty-input digest', async () => {
    const result = await checksumBytes(new Uint8Array([]))
    expect(result.size).toBe(0)
    expect(result.sha256).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})

describe('digestFor', () => {
  it('reads each algorithm out of a result', async () => {
    const result = await checksumText('abc')
    expect(digestFor(result, 'SHA-256')).toBe(result.sha256)
    expect(digestFor(result, 'CRC-32')).toBe(result.crc32)
  })

  it('returns an empty string for an unknown algorithm', async () => {
    expect(digestFor(await checksumText('abc'), 'MD5')).toBe('')
  })
})

describe('normalizeHex', () => {
  it('lowercases and strips separators and a 0x prefix', () => {
    expect(normalizeHex('  BA7816BF  ')).toBe('ba7816bf')
    expect(normalizeHex('ba:78:16:bf')).toBe('ba7816bf')
    expect(normalizeHex('ba-78-16-bf')).toBe('ba7816bf')
    expect(normalizeHex('0xba7816bf')).toBe('ba7816bf')
  })

  it('rejects non-hex and empty input', () => {
    expect(normalizeHex('')).toBeNull()
    expect(normalizeHex('   ')).toBeNull()
    expect(normalizeHex('hello!')).toBeNull()
    expect(normalizeHex('ba7816bg')).toBeNull()
  })
})

describe('identifyDigest', () => {
  it('names the algorithm from the hex length', () => {
    expect(identifyDigest('cbf43926')).toEqual({ algorithm: 'CRC-32', hex: 'cbf43926' })
    expect(identifyDigest('a'.repeat(40))?.algorithm).toBe('SHA-1')
    expect(identifyDigest('a'.repeat(64))?.algorithm).toBe('SHA-256')
    expect(identifyDigest('a'.repeat(96))?.algorithm).toBe('SHA-384')
    expect(identifyDigest('a'.repeat(128))?.algorithm).toBe('SHA-512')
  })

  it('returns null for a length no algorithm uses', () => {
    expect(identifyDigest('a'.repeat(63))).toBeNull()
    expect(identifyDigest('nothex')).toBeNull()
  })
})

describe('verify', () => {
  it('matches the right algorithm by length', async () => {
    const result = await checksumText('hello')
    expect(verify(result.crc32, result)).toMatchObject({ status: 'match', algorithm: 'CRC-32' })
    expect(verify(result.sha256.toUpperCase(), result)).toMatchObject({ status: 'match', algorithm: 'SHA-256' })
  })

  it('reports a mismatch for valid hex of a known length', async () => {
    const result = await checksumText('hello')
    expect(verify('0'.repeat(64), result)).toMatchObject({ status: 'mismatch', algorithm: 'SHA-256' })
  })

  it('reports unknown for non-hex or unrecognised lengths', async () => {
    const result = await checksumText('hello')
    expect(verify('hello world', result)).toMatchObject({ status: 'unknown' })
    expect(verify('abcdef', result)).toMatchObject({ status: 'unknown' })
  })
})

describe('parseExpectedLine', () => {
  const hex64 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

  it('reads a bare digest', () => {
    expect(parseExpectedLine(hex64)).toEqual({ algorithm: 'SHA-256', hex: hex64 })
  })

  it('reads coreutils "<hex>  <file>" output', () => {
    expect(parseExpectedLine(`${hex64}  some file.txt`)).toEqual({ algorithm: 'SHA-256', hex: hex64 })
  })

  it('reads BSD "SHA256 (file) = <hex>" output', () => {
    expect(parseExpectedLine(`SHA256 (some file.txt) = ${hex64}`)).toEqual({ algorithm: 'SHA-256', hex: hex64 })
  })

  it('returns null for an empty line or unknown digest', () => {
    expect(parseExpectedLine('')).toBeNull()
    expect(parseExpectedLine('no digest here')).toBeNull()
  })

  it('reads a colon-grouped digest with no filename', () => {
    const grouped = hex64.match(/.{2}/g)!.join(':')
    expect(parseExpectedLine(grouped)).toEqual({ algorithm: 'SHA-256', hex: hex64 })
  })

  it('reads BSD output for a CRC-32 digest', () => {
    expect(parseExpectedLine('CRC32 (file.bin) = cbf43926')).toEqual({ algorithm: 'CRC-32', hex: 'cbf43926' })
  })

  it('reads coreutils binary-mode "*" separator', () => {
    expect(parseExpectedLine(`${hex64} *file.bin`)).toEqual({ algorithm: 'SHA-256', hex: hex64 })
  })
})

describe('toHex', () => {
  it('lowercases and zero-pads each byte', () => {
    expect(toHex(new Uint8Array([0, 15, 255]))).toBe('000fff')
  })

  it('renders an empty array as an empty string', () => {
    expect(toHex(new Uint8Array([]))).toBe('')
  })
})
