import { describe, expect, it } from 'vitest'
import {
  base32Decode, base32Encode, base58CheckDecode, base58CheckEncode, base58Decode, base58Encode,
  bytesFromText, fromBinary, fromHex, textFromBytes, toBinary, toHex,
} from './base'

const bytes = (s: string) => bytesFromText(s)

describe('hex', () => {
  it('round-trips and uppercases', () => {
    expect(toHex(bytes('Hi'))).toBe('4869')
    expect(toHex(bytes('Hi'), true)).toBe('4869')
    expect([...fromHex('48 69')]).toEqual([...bytes('Hi')])
  })

  it('rejects odd or invalid input', () => {
    expect(() => fromHex('abc')).toThrow()
    expect(() => fromHex('zz')).toThrow()
  })
})

describe('binary', () => {
  it('round-trips', () => {
    expect(toBinary(new Uint8Array([0b10100000]))).toBe('10100000')
    expect([...fromBinary('10100000')]).toEqual([0b10100000])
  })

  it('rejects non-multiples of eight bits', () => {
    expect(() => fromBinary('101')).toThrow()
  })
})

describe('base32', () => {
  it('matches RFC 4648 vectors', () => {
    expect(base32Encode(bytes(''))).toBe('')
    expect(base32Encode(bytes('f'))).toBe('MY======')
    expect(base32Encode(bytes('fo'))).toBe('MZXQ====')
    expect(base32Encode(bytes('foobar'))).toBe('MZXW6YTBOI======')
  })

  it('round-trips and is case-insensitive', () => {
    const source = new Uint8Array([0, 255, 16, 32, 64])
    expect([...base32Decode(base32Encode(source))]).toEqual([...source])
    expect([...base32Decode('mzxw6ytboi======')]).toEqual([...bytes('foobar')])
  })
})

describe('base58', () => {
  it('matches known vectors', () => {
    expect(base58Encode(bytes(''))).toBe('')
    expect(base58Encode(bytes('Hello World!'))).toBe('2NEpo7TZRRrLZSi2U')
  })

  it('preserves leading zero bytes', () => {
    const source = new Uint8Array([0, 0, 1])
    expect(base58Decode(base58Encode(source))).toEqual(source)
  })

  it('round-trips arbitrary bytes', () => {
    const source = new Uint8Array([1, 2, 3, 250, 251, 252])
    expect([...base58Decode(base58Encode(source))]).toEqual([...source])
  })

  it('rejects ambiguous characters', () => {
    expect(() => base58Decode('0OIl')).toThrow()
  })
})

describe('base58Check', () => {
  it('round-trips a payload', async () => {
    const payload = new Uint8Array([0x00, 1, 2, 3, 4, 5])
    const encoded = await base58CheckEncode(payload)
    expect([...(await base58CheckDecode(encoded))]).toEqual([...payload])
  })

  it('detects a flipped character', async () => {
    const encoded = await base58CheckEncode(new Uint8Array([1, 2, 3, 4]))
    const broken = encoded.slice(0, -1) + (encoded.endsWith('2') ? '3' : '2')
    await expect(base58CheckDecode(broken)).rejects.toThrow()
  })
})

describe('text helpers', () => {
  it('round-trips UTF-8', () => {
    expect(textFromBytes(bytes('héllo 😀'))).toBe('héllo 😀')
  })
})
