/**
 * JWT decoding and verification.
 *
 * Decoding is pure string work. Verification uses WebCrypto so the signature is
 * checked without any network call: HMAC for HS, RSA (PKCS#1 v1.5 and PSS) for
 * the RS and PS families, and ECDSA for ES. Keys are supplied as a shared secret,
 * a PEM public key, or a JWK.
 */

export interface DecodedJwt {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  headerJson: string
  payloadJson: string
  signature: string
  raw: string
}

export type ClaimLevel = 'error' | 'warning' | 'ok'

export interface ClaimNote {
  level: ClaimLevel
  message: string
}

export class JwtError extends Error {}

export function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeSegment(segment: string, label: string): Record<string, unknown> {
  let text: string
  try {
    text = new TextDecoder().decode(base64UrlToBytes(segment))
  } catch {
    throw new JwtError(`The ${label} is not valid base64url.`)
  }
  try {
    const parsed = JSON.parse(text)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object')
    }
    return parsed as Record<string, unknown>
  } catch {
    throw new JwtError(`The ${label} is not valid JSON.`)
  }
}

/** Split and decode a JWT without verifying it. */
export function decodeJwt(token: string): DecodedJwt {
  const raw = token.trim()
  if (!raw) throw new JwtError('Paste a token to decode.')
  const parts = raw.split('.')
  if (parts.length !== 3) {
    throw new JwtError(`A JWT has three parts separated by dots; this has ${parts.length}.`)
  }
  const header = decodeSegment(parts[0], 'header')
  const payload = decodeSegment(parts[1], 'payload')
  return {
    header,
    payload,
    headerJson: JSON.stringify(header, null, 2),
    payloadJson: JSON.stringify(payload, null, 2),
    signature: parts[2],
    raw,
  }
}

const TIME_CLAIMS = ['exp', 'nbf', 'iat'] as const

/** Describe the time-based claims relative to `now` (seconds). */
export function analyzeClaims(payload: Record<string, unknown>, now: number = Date.now() / 1000): ClaimNote[] {
  const notes: ClaimNote[] = []

  for (const name of TIME_CLAIMS) {
    const value = payload[name]
    if (value === undefined) continue
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      notes.push({ level: 'warning', message: `"${name}" is not a number.` })
      continue
    }
    const when = new Date(value * 1000).toISOString()
    if (name === 'exp') {
      notes.push(
        value < now
          ? { level: 'error', message: `Expired ${formatAgo(now - value)} ago (${when}).` }
          : { level: 'ok', message: `Valid until ${when}.` },
      )
    } else if (name === 'nbf') {
      notes.push(
        value > now
          ? { level: 'warning', message: `Not valid until ${when}.` }
          : { level: 'ok', message: `Valid since ${when}.` },
      )
    } else {
      notes.push({ level: 'ok', message: `Issued at ${when}.` })
    }
  }

  if (payload.exp === undefined) {
    notes.push({ level: 'warning', message: 'No "exp" claim: this token never expires.' })
  }

  return notes
}

function formatAgo(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

const HMAC_ALGS: Record<string, string> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512',
}

const RSA_ALGS: Record<string, { name: string; hash: string }> = {
  RS256: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
  RS384: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' },
  RS512: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
  PS256: { name: 'RSA-PSS', hash: 'SHA-256' },
  PS384: { name: 'RSA-PSS', hash: 'SHA-384' },
  PS512: { name: 'RSA-PSS', hash: 'SHA-512' },
}

const EC_ALGS: Record<string, { curve: string; hash: string }> = {
  ES256: { curve: 'P-256', hash: 'SHA-256' },
  ES384: { curve: 'P-384', hash: 'SHA-384' },
  ES512: { curve: 'P-521', hash: 'SHA-512' },
}

const PSS_SALT: Record<string, number> = { PS256: 32, PS384: 48, PS512: 64 }

function pemToBytes(pem: string): Uint8Array {
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  if (!body) throw new JwtError('The PEM key is empty.')
  try {
    const binary = atob(body)
    return Uint8Array.from(binary, (char) => char.charCodeAt(0))
  } catch {
    throw new JwtError('The PEM key is not valid base64.')
  }
}

/** Copy bytes into a freshly allocated buffer (WebCrypto wants a plain ArrayBuffer view). */
function exact(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(bytes.byteLength)
  out.set(bytes)
  return out
}

export interface VerifyOptions {
  /** Shared secret for HS, PEM public key or JWK for RS, PS and ES. */
  key: string
  /** Treat the key as a JWK even if it is not obviously one. */
  keyFormat?: 'auto' | 'pem' | 'jwk'
}

export interface VerifyResult {
  valid: boolean
  algorithm: string
  reason?: string
}

/** Verify a token's signature against the supplied key. */
export async function verifyJwt(token: string, options: VerifyOptions): Promise<VerifyResult> {
  const decoded = decodeJwt(token)
  const algorithm = String(decoded.header.alg ?? '')
  if (!algorithm) throw new JwtError('The header has no "alg".')

  if (algorithm === 'none') {
    return { valid: false, algorithm, reason: 'alg is "none": the token is unsigned and must not be trusted.' }
  }

  const parts = decoded.raw.split('.')
  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  const signature = base64UrlToBytes(parts[2])

  try {
    if (HMAC_ALGS[algorithm]) {
      if (!options.key) throw new JwtError('Enter the shared secret to verify an HS* token.')
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(options.key),
        { name: 'HMAC', hash: HMAC_ALGS[algorithm] },
        false,
        ['verify'],
      )
      const valid = await crypto.subtle.verify('HMAC', key, exact(signature), signingInput)
      return { valid, algorithm, reason: valid ? undefined : 'Signature does not match.' }
    }

    if (RSA_ALGS[algorithm]) {
      const key = await importAsymmetric(algorithm, options)
      const params =
        RSA_ALGS[algorithm].name === 'RSA-PSS'
          ? { name: 'RSA-PSS', saltLength: PSS_SALT[algorithm] }
          : { name: 'RSASSA-PKCS1-v1_5' }
      const valid = await crypto.subtle.verify(params, key, exact(signature), signingInput)
      return { valid, algorithm, reason: valid ? undefined : 'Signature does not match.' }
    }

    if (EC_ALGS[algorithm]) {
      const key = await importAsymmetric(algorithm, options)
      const valid = await crypto.subtle.verify(
        { name: 'ECDSA', hash: EC_ALGS[algorithm].hash },
        key,
        exact(signature),
        signingInput,
      )
      return { valid, algorithm, reason: valid ? undefined : 'Signature does not match.' }
    }

    throw new JwtError(`Unsupported algorithm "${algorithm}".`)
  } catch (error) {
    if (error instanceof JwtError) throw error
    throw new JwtError(error instanceof Error ? error.message : 'Verification failed.')
  }
}

async function importAsymmetric(algorithm: string, options: VerifyOptions): Promise<CryptoKey> {
  if (!options.key.trim()) throw new JwtError(`Supply the public key to verify an ${algorithm} token.`)

  const looksLikeJwk = options.keyFormat === 'jwk' || options.key.trim().startsWith('{')
  if (looksLikeJwk) {
    let jwk: JsonWebKey
    try {
      jwk = JSON.parse(options.key) as JsonWebKey
    } catch {
      throw new JwtError('The JWK is not valid JSON.')
    }
    return crypto.subtle.importKey('jwk', jwk, algorithmParams(algorithm), false, ['verify'])
  }

  const der = exact(pemToBytes(options.key))
  return crypto.subtle.importKey('spki', der, algorithmParams(algorithm), false, ['verify'])
}

function algorithmParams(algorithm: string): AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams {
  if (RSA_ALGS[algorithm]) {
    return { name: RSA_ALGS[algorithm].name, hash: RSA_ALGS[algorithm].hash }
  }
  if (EC_ALGS[algorithm]) {
    return { name: 'ECDSA', namedCurve: EC_ALGS[algorithm].curve }
  }
  throw new JwtError(`Unsupported algorithm "${algorithm}".`)
}

/** Sign a token, used by the tests and available for local experimentation. */
export async function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  secret: string,
  algorithm: 'HS256' | 'HS384' | 'HS512' = 'HS256',
): Promise<string> {
  const encodedHeader = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(header)))
  const encodedPayload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: HMAC_ALGS[algorithm] },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  )
  return `${encodedHeader}.${encodedPayload}.${bytesToBase64Url(new Uint8Array(signature))}`
}
