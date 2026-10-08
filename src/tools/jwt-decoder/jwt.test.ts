import { describe, expect, it } from 'vitest'
import {
  analyzeClaims,
  bytesToBase64Url,
  decodeJwt,
  JwtError,
  signJwt,
  verifyJwt,
} from './jwt'

const NOW = 1_700_000_000

function toPem(bytes: Uint8Array, label: string): string {
  const base64 = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))
  const lines = base64.match(/.{1,64}/g) ?? []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

function b64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

describe('decodeJwt', () => {
  it('decodes a token in the URL form users paste', async () => {
    const token = await signJwt({ alg: 'HS256', typ: 'JWT' }, { sub: '123', name: 'Ada' }, 'secret')
    const decoded = decodeJwt(token)
    expect(decoded.header).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(decoded.payload).toEqual({ sub: '123', name: 'Ada' })
    expect(decoded.signature).not.toBe('')
  })

  it('handles whitespace around the token', async () => {
    const token = await signJwt({ alg: 'HS256' }, { a: 1 }, 'secret')
    expect(decodeJwt(`  ${token}\n`).payload).toEqual({ a: 1 })
  })

  it('rejects a token with the wrong number of parts', () => {
    expect(() => decodeJwt('aaa.bbb')).toThrow(/three parts/)
  })

  it('rejects an empty token', () => {
    expect(() => decodeJwt('   ')).toThrow(JwtError)
  })

  it('rejects a header that is not JSON', () => {
    const bad =
      bytesToBase64Url(new TextEncoder().encode('not json')) +
      '.' +
      bytesToBase64Url(new TextEncoder().encode('{}')) +
      '.sig'
    expect(() => decodeJwt(bad)).toThrow(/header is not valid JSON/)
  })

  it('rejects a payload that is not valid base64url', () => {
    expect(() => decodeJwt('!!!.@@@.###')).toThrow(JwtError)
  })

  it('pretty-prints the segments', async () => {
    const token = await signJwt({ alg: 'HS256' }, { x: 1 }, 's')
    expect(decodeJwt(token).payloadJson).toBe('{\n  "x": 1\n}')
  })
})

describe('analyzeClaims', () => {
  it('reports an expired token', () => {
    const notes = analyzeClaims({ exp: NOW - 3600 }, NOW)
    expect(notes[0].level).toBe('error')
    expect(notes[0].message).toMatch(/Expired 1h ago/)
  })

  it('reports a valid token', () => {
    expect(analyzeClaims({ exp: NOW + 60 }, NOW)[0].level).toBe('ok')
  })

  it('flags a not-yet-valid token', () => {
    const notes = analyzeClaims({ nbf: NOW + 600 }, NOW)
    expect(notes[0].level).toBe('warning')
    expect(notes[0].message).toMatch(/not valid until/i)
  })

  it('warns when there is no expiry', () => {
    expect(analyzeClaims({ sub: 'x' }, NOW).some((n) => /never expires/i.test(n.message))).toBe(true)
  })

  it('warns when a time claim is not a number', () => {
    expect(analyzeClaims({ exp: 'soon' }, NOW)[0].level).toBe('warning')
  })
})

describe('verifyJwt with HMAC', () => {
  it('accepts a correctly signed token', async () => {
    const token = await signJwt({ alg: 'HS256' }, { sub: '123' }, 'topsecret')
    expect((await verifyJwt(token, { key: 'topsecret' })).valid).toBe(true)
  })

  it('rejects the wrong secret', async () => {
    const token = await signJwt({ alg: 'HS256' }, { sub: '123' }, 'topsecret')
    expect((await verifyJwt(token, { key: 'wrong' })).valid).toBe(false)
  })

  it('rejects a tampered payload', async () => {
    const token = await signJwt({ alg: 'HS256' }, { sub: '123' }, 'topsecret')
    const [header, , signature] = token.split('.')
    const forged = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ sub: 'admin' })))
    expect((await verifyJwt(`${header}.${forged}.${signature}`, { key: 'topsecret' })).valid).toBe(false)
  })

  it('refuses an unsigned "none" token', async () => {
    const header = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ alg: 'none', typ: 'JWT' })))
    const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ sub: '1' })))
    const result = await verifyJwt(`${header}.${payload}.`, { key: 'anything' })
    expect(result.valid).toBe(false)
    expect(result.reason).toMatch(/unsigned/)
  })

  it('throws when the secret is missing', async () => {
    const token = await signJwt({ alg: 'HS256' }, { sub: '1' }, 's')
    await expect(verifyJwt(token, { key: '' })).rejects.toThrow(JwtError)
  })

  it('throws on an unsupported algorithm', async () => {
    const token = await signJwt({ alg: 'HS256' }, { sub: '1' }, 's')
    const header = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ alg: 'XX999' })))
    await expect(verifyJwt(`${header}.${token.split('.')[1]}.AAAA`, { key: 's' })).rejects.toThrow(/Unsupported/)
  })
})

describe('verifyJwt with public-key algorithms', () => {
  it('verifies a real RS256 signature', async () => {
    const pair = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    )
    const header = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256' })))
    const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ sub: 'rsa' })))
    const data = new TextEncoder().encode(`${header}.${payload}`)
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, data)
    const token = `${header}.${payload}.${bytesToBase64Url(new Uint8Array(signature))}`
    const pem = toPem(new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey)), 'PUBLIC KEY')

    expect((await verifyJwt(token, { key: pem })).valid).toBe(true)

    const forged = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ sub: 'evil' })))
    expect((await verifyJwt(`${header}.${forged}.${token.split('.')[2]}`, { key: pem })).valid).toBe(false)
  })

  it('verifies a real ES256 signature', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const header = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ alg: 'ES256' })))
    const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ sub: 'ec' })))
    const data = new TextEncoder().encode(`${header}.${payload}`)
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, data)
    const token = `${header}.${payload}.${bytesToBase64Url(new Uint8Array(signature))}`
    const pem = toPem(new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey)), 'PUBLIC KEY')

    expect((await verifyJwt(token, { key: pem })).valid).toBe(true)

    const other = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const otherPem = toPem(new Uint8Array(await crypto.subtle.exportKey('spki', other.publicKey)), 'PUBLIC KEY')
    expect((await verifyJwt(token, { key: otherPem })).valid).toBe(false)
  })

  it('verifies with a JWK public key', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey)
    const header = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ alg: 'ES256' })))
    const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ sub: 'jwk' })))
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.privateKey,
      new TextEncoder().encode(`${header}.${payload}`),
    )
    const token = `${header}.${payload}.${bytesToBase64Url(new Uint8Array(signature))}`

    expect((await verifyJwt(token, { key: JSON.stringify(jwk) })).valid).toBe(true)
  })
})

describe('signJwt', () => {
  it('produces a signature WebCrypto independently confirms', async () => {
    const token = await signJwt({ alg: 'HS256' }, { a: 1 }, 'key')
    const [header, payload, signature] = token.split('.')
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('key'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const ok = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlToBytes(signature),
      new TextEncoder().encode(`${header}.${payload}`),
    )
    expect(ok).toBe(true)
  })
})
