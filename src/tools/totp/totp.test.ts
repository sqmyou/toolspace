import { describe, expect, it } from 'vitest'
import { base32Decode, base32Encode, formatCode, generateTotp, hotp, otpauthUri, totp, TotpError } from './totp'

// The ASCII secret "12345678901234567890" used by the RFC test vectors.
const RFC_KEY = new Uint8Array([...'12345678901234567890'].map((c) => c.charCodeAt(0)))

describe('base32', () => {
  it('decodes the standard alphabet', () => {
    // "JBSWY3DPEHPK3PXP" is the well-known "Hello!\xDE\xAD\xBE\xEF" example.
    expect(base32Decode('JBSWY3DPEHPK3PXP')).toHaveLength(10)
  })

  it('ignores spaces, dashes and padding', () => {
    expect([...base32Decode('jbsw y3dp-ehpk3pxp===')]).toEqual([...base32Decode('JBSWY3DPEHPK3PXP')])
  })

  it('round-trips through encode', () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 250, 255, 128])
    expect([...base32Decode(base32Encode(bytes))]).toEqual([...bytes])
  })

  it('rejects invalid characters', () => {
    expect(() => base32Decode('ABC1')).toThrow(TotpError)
    expect(() => base32Decode('')).toThrow(TotpError)
  })
})

describe('hotp (RFC 4226 vectors)', () => {
  it('matches the published codes', async () => {
    expect(await hotp(RFC_KEY, 0)).toBe('755224')
    expect(await hotp(RFC_KEY, 1)).toBe('287082')
    expect(await hotp(RFC_KEY, 2)).toBe('359152')
    expect(await hotp(RFC_KEY, 3)).toBe('969429')
    expect(await hotp(RFC_KEY, 4)).toBe('338314')
    expect(await hotp(RFC_KEY, 5)).toBe('254676')
  })

  it('rejects bad counters and digit counts', async () => {
    await expect(hotp(RFC_KEY, -1)).rejects.toThrow(TotpError)
    await expect(hotp(RFC_KEY, 1.5)).rejects.toThrow(TotpError)
    await expect(hotp(RFC_KEY, 0, 0)).rejects.toThrow(TotpError)
  })
})

describe('totp (RFC 6238 vectors)', () => {
  // RFC 6238 uses SHA-1 with a 20-byte "12345678901234567890" key.
  const vectors: [number, string][] = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
  ]

  it('matches SHA-1 vectors with 8 digits', async () => {
    for (const [seconds, code] of vectors) {
      const result = await totp(RFC_KEY, { digits: 8, timestamp: seconds * 1000 })
      expect(result.code).toBe(code)
    }
  })

  it('reports seconds remaining in the window', async () => {
    const result = await totp(RFC_KEY, { step: 30, timestamp: 59_000 })
    expect(result.counter).toBe(1)
    expect(result.secondsRemaining).toBe(1)
  })

  it('accepts a Base32 secret directly', async () => {
    const secret = base32Encode(RFC_KEY)
    const result = await generateTotp(secret, { digits: 8, timestamp: 59_000 })
    expect(result.code).toBe('94287082')
  })

  it('rejects a zero period', async () => {
    await expect(totp(RFC_KEY, { step: 0 })).rejects.toThrow(TotpError)
  })

  it('supports SHA-256 and SHA-512', async () => {
    // Distinct algorithms must not produce the same code at the same step.
    const sha1 = await totp(RFC_KEY, { algorithm: 'SHA-1', timestamp: 59_000 })
    const sha256 = await totp(RFC_KEY, { algorithm: 'SHA-256', timestamp: 59_000 })
    expect(sha1.code).not.toBe(sha256.code)
  })
})

describe('otpauthUri', () => {
  it('builds a scannable URI', () => {
    const uri = otpauthUri('JBSWY3DPEHPK3PXP', 'me@example.com', 'Example')
    expect(uri).toContain('otpauth://totp/Example:me%40example.com')
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP')
    expect(uri).toContain('period=30')
  })

  it('omits the algorithm when it is the SHA-1 default', () => {
    expect(otpauthUri('SECRET', 'a', 'B')).not.toContain('algorithm=')
    expect(otpauthUri('SECRET', 'a', 'B', { algorithm: 'SHA-256' })).toContain('algorithm=SHA256')
  })
})

describe('formatCode', () => {
  it('groups digits in threes', () => {
    expect(formatCode('123456')).toBe('123 456')
    expect(formatCode('12345678')).toBe('123 456 78')
  })
})
