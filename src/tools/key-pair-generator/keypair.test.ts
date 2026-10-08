import { describe, expect, it } from 'vitest'
import { generateKeyPair } from './keypair'

const hasEd25519 = (() => {
  try {
    // Feature-detect without generating, to keep the suite fast and portable.
    return typeof (globalThis.crypto?.subtle as unknown as { generateKey?: unknown })?.generateKey === 'function'
  } catch {
    return false
  }
})()

describe('generateKeyPair', () => {
  it('generates an ECDSA P-256 pair as PEM', async () => {
    const pair = await generateKeyPair('ECDSA-P256')
    expect(pair.publicKey).toMatch(/^-----BEGIN PUBLIC KEY-----/)
    expect(pair.publicKey).toMatch(/-----END PUBLIC KEY-----$/)
    expect(pair.privateKey).toMatch(/^-----BEGIN PRIVATE KEY-----/)
    expect(pair.algorithm).toBe('ECDSA-P256')
  })

  it('wraps base64 bodies at 64 characters', async () => {
    const pair = await generateKeyPair('ECDSA-P256')
    const body = pair.publicKey.split('\n').slice(1, -1)
    expect(body.every((line) => line.length <= 64)).toBe(true)
  })

  it('produces different keys each time', async () => {
    const a = await generateKeyPair('ECDSA-P384')
    const b = await generateKeyPair('ECDSA-P384')
    expect(a.publicKey).not.toBe(b.publicKey)
  })

  it.runIf(hasEd25519)('generates an Ed25519 pair', async () => {
    const pair = await generateKeyPair('Ed25519')
    expect(pair.publicKey).toMatch(/BEGIN PUBLIC KEY/)
  })
})
