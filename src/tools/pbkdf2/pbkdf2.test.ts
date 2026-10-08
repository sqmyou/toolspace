import { describe, expect, it } from 'vitest'
import { derive, deriveBits, describeCost, encodeSalt, fromBase64, fromHex, Pbkdf2Error, randomSalt, toBase64, toHex } from './pbkdf2'

const encode = (text: string) => new TextEncoder().encode(text)

describe('hex', () => {
  it('round-trips bytes', () => {
    const bytes = new Uint8Array([0, 15, 16, 255, 128])
    expect(toHex(bytes)).toBe('000f10ff80')
    expect([...fromHex('000f10ff80')]).toEqual([...bytes])
  })

  it('rejects malformed hex', () => {
    expect(() => fromHex('abc')).toThrow(Pbkdf2Error)
    expect(() => fromHex('zz')).toThrow(Pbkdf2Error)
  })
})

describe('base64', () => {
  it('round-trips bytes', () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 255])
    expect([...fromBase64(toBase64(bytes))]).toEqual([...bytes])
  })

  it('rejects invalid base64', () => {
    expect(() => fromBase64('!!!!')).toThrow(Pbkdf2Error)
  })
})

describe('deriveBits (RFC 6070 vectors)', () => {
  it('matches the SHA-1 test vectors', async () => {
    const cases: [string, string, number, number, string][] = [
      ['password', 'salt', 1, 20, '0c60c80f961f0e71f3a9b524af6012062fe037a6'],
      ['password', 'salt', 2, 20, 'ea6c014dc72d6f8ccd1ed92ace1d41f0d8de8957'],
      ['password', 'salt', 4096, 20, '4b007901b765489abead49d926f721d065a429c1'],
      ['passwordPASSWORDpassword', 'saltSALTsaltSALTsaltSALTsaltSALTsalt', 4096, 25, '3d2eec4fe41c849b80c8d83662c0e44a8b291a964cf2f07038'],
    ]
    for (const [password, salt, iterations, length, expected] of cases) {
      const bits = await deriveBits(encode(password), encode(salt), iterations, 'SHA-1', length)
      expect(toHex(bits)).toBe(expected)
    }
  })

  it('rejects an invalid iteration count and length', async () => {
    await expect(deriveBits(encode('p'), encode('s'), 0, 'SHA-256', 16)).rejects.toThrow(Pbkdf2Error)
    await expect(deriveBits(encode('p'), encode('s'), 1, 'SHA-256', 0)).rejects.toThrow(Pbkdf2Error)
    await expect(deriveBits(encode('p'), encode('s'), 1, 'SHA-256', 2000)).rejects.toThrow(Pbkdf2Error)
  })
})

describe('derive', () => {
  it('returns matching hex and base64', async () => {
    const result = await derive('password', 'salt', { iterations: 1, hash: 'SHA-1', length: 20 })
    expect(result.hex).toBe('0c60c80f961f0e71f3a9b524af6012062fe037a6')
    expect(fromBase64(result.base64)).toHaveLength(20)
  })

  it('defaults to SHA-256 with 32 bytes', async () => {
    const result = await derive('password', 'salt', { iterations: 1000 })
    expect(result.hash).toBe('SHA-256')
    expect(result.hex).toHaveLength(64)
  })

  it('accepts a hex-encoded salt', async () => {
    const a = await derive('p', '73616c74', { iterations: 1, hash: 'SHA-1', length: 20, saltEncoding: 'hex' })
    const b = await derive('p', 'salt', { iterations: 1, hash: 'SHA-1', length: 20 })
    expect(a.hex).toBe(b.hex)
  })

  it('produces different output for different hashes', async () => {
    const a = await derive('p', 's', { iterations: 100, hash: 'SHA-256' })
    const b = await derive('p', 's', { iterations: 100, hash: 'SHA-512' })
    expect(a.hex).not.toBe(b.hex)
  })
})

describe('randomSalt', () => {
  it('returns the requested number of bytes as hex', () => {
    expect(randomSalt(16)).toHaveLength(32)
    expect(randomSalt(16)).not.toBe(randomSalt(16))
  })

  it('rejects out-of-range lengths', () => {
    expect(() => randomSalt(4)).toThrow(Pbkdf2Error)
  })
})

describe('describeCost', () => {
  it('grades the iteration count', () => {
    expect(describeCost(50_000)).toMatch(/Low/)
    expect(describeCost(200_000)).toMatch(/Moderate/)
    expect(describeCost(400_000)).toMatch(/Good/)
    expect(describeCost(600_000)).toMatch(/Strong/)
  })
})

describe('encodeSalt', () => {
  it('formats according to the chosen encoding', () => {
    expect(encodeSalt(encode('salt'), 'hex')).toBe('73616c74')
    expect(encodeSalt(encode('salt'), 'utf8')).toBe('salt')
  })
})
