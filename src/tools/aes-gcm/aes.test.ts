import { describe, expect, it } from 'vitest'
import { bundleMode, decrypt, encrypt, fromBase64, isBundle, parseBundle, toBase64 } from './aes'

describe('base64 helpers', () => {
  it('round-trips bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255])
    expect([...fromBase64(toBase64(bytes))]).toEqual([...bytes])
  })
})

describe('encrypt / decrypt', () => {
  it('round-trips a message', async () => {
    const bundle = await encrypt('correct horse', 'hello secret')
    expect(isBundle(bundle)).toBe(true)
    expect(await decrypt('correct horse', bundle)).toBe('hello secret')
  })

  it('uses a fresh salt and iv per call', async () => {
    const a = await encrypt('pw', 'same')
    const b = await encrypt('pw', 'same')
    expect(a).not.toBe(b)
  })

  it('rejects the wrong passphrase', async () => {
    const bundle = await encrypt('pw', 'secret')
    await expect(decrypt('other', bundle)).rejects.toThrow(/Could not decrypt/)
  })

  it('detects tampering in gcm', async () => {
    const bundle = await encrypt('pw', 'secret')
    const parts = bundle.split('.')
    const cipher = parts[3]
    parts[3] = (cipher[0] === 'A' ? 'B' : 'A') + cipher.slice(1)
    await expect(decrypt('pw', parts.join('.'))).rejects.toThrow()
  })

  it('rejects malformed bundles', async () => {
    await expect(decrypt('pw', 'not-a-bundle')).rejects.toThrow(/toolspace AES bundle/)
  })

  it('requires a passphrase', async () => {
    await expect(encrypt('', 'x')).rejects.toThrow(/passphrase/)
  })

  it('still writes the original gcm bundle shape', async () => {
    const bundle = await encrypt('pw', 'legacy', 'gcm')
    expect(bundle.startsWith('tsgcm1.')).toBe(true)
    expect(bundle.split('.')).toHaveLength(4)
  })
})

describe('cbc and ctr modes', () => {
  it.each(['gcm', 'cbc', 'ctr'] as const)('round-trips with %s', async (mode) => {
    const bundle = await encrypt('correct horse', 'hello secret', mode)
    expect(bundleMode(bundle)).toBe(mode)
    expect(await decrypt('correct horse', bundle)).toBe('hello secret')
  })

  it('tags cbc and ctr bundles with the new format', async () => {
    expect(await encrypt('pw', 'x', 'cbc')).toMatch(/^tsaes1\.cbc\./)
    expect(await encrypt('pw', 'x', 'ctr')).toMatch(/^tsaes1\.ctr\./)
  })

  it('encrypts non-ascii text in every mode', async () => {
    const text = 'héllo — 世界 🌍'
    for (const mode of ['gcm', 'cbc', 'ctr'] as const) {
      expect(await decrypt('pw', await encrypt('pw', text, mode))).toBe(text)
    }
  })

  it('gcm rejects the wrong passphrase', async () => {
    const bundle = await encrypt('pw', 'secret', 'gcm')
    await expect(decrypt('other', bundle)).rejects.toThrow(/Could not decrypt/)
  })

  it('cbc and ctr are unauthenticated, so a wrong passphrase never returns the plaintext', async () => {
    // Neither mode carries an authentication tag. CBC may throw on bad padding;
    // CTR never throws. What matters is that neither yields the real message.
    for (const mode of ['cbc', 'ctr'] as const) {
      const bundle = await encrypt('pw', 'the real secret', mode)
      let result: string | null = null
      try {
        result = await decrypt('wrong', bundle)
      } catch {
        result = null
      }
      expect(result).not.toBe('the real secret')
    }
  })

  it('reports the mode of an unauthenticated bundle so the UI can warn', async () => {
    expect(bundleMode(await encrypt('pw', 'x', 'cbc'))).toBe('cbc')
  })

  it('reports null for a non-bundle', () => {
    expect(bundleMode('hello')).toBeNull()
  })

  it('keeps the four-part legacy shape for gcm', () => {
    expect(parseBundle('tsgcm1.AAAA.BBBB.CCCC')).toEqual({
      mode: 'gcm',
      salt: 'AAAA',
      iv: 'BBBB',
      cipher: 'CCCC',
    })
  })

  it('keeps the five-part shape for cbc', () => {
    expect(parseBundle('tsaes1.cbc.AAAA.BBBB.CCCC')).toEqual({
      mode: 'cbc',
      salt: 'AAAA',
      iv: 'BBBB',
      cipher: 'CCCC',
    })
  })

  it('ignores an unknown mode tag', () => {
    expect(parseBundle('tsaes1.xyz.AAAA.BBBB.CCCC')).toBeNull()
  })

  it('requires a passphrase to decrypt too', async () => {
    const bundle = await encrypt('pw', 'secret', 'cbc')
    await expect(decrypt('', bundle)).rejects.toThrow(/passphrase/)
  })
})
