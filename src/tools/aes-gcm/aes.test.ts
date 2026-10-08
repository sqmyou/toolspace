import { describe, expect, it } from 'vitest'
import { decrypt, encrypt, fromBase64, isBundle, toBase64 } from './aes'

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

  it('detects tampering', async () => {
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
})
