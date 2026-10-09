/**
 * Passphrase-based AES encryption using WebCrypto.
 *
 * Three block modes share one key-derivation path (PBKDF2-SHA256 with a random
 * per-message salt) and one bundle shape, so a message carries everything needed
 * to decrypt it:
 *
 *   gcm  tsgcm1.<salt>.<iv>.<ciphertext>
 *   cbc  tsaes1.cbc.<salt>.<iv>.<ciphertext>
 *   ctr  tsaes1.ctr.<salt>.<iv>.<ciphertext>
 *
 * The gcm prefix is unchanged from the original tool so existing bundles keep
 * decrypting. GCM is authenticated; CBC and CTR are not, and exist only for
 * interoperability with systems that require them.
 */

const FORMAT_GCM = 'tsgcm1'
const FORMAT_AES = 'tsaes1'
const SALT_BYTES = 16
const IV_BYTES = { gcm: 12, cbc: 16, ctr: 16 } as const
const ITERATIONS = 250_000

export type AesMode = 'gcm' | 'cbc' | 'ctr'

const ALGORITHM: Record<AesMode, 'AES-GCM' | 'AES-CBC' | 'AES-CTR'> = {
  gcm: 'AES-GCM',
  cbc: 'AES-CBC',
  ctr: 'AES-CTR',
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveKey(passphrase: string, salt: Uint8Array, mode: AesMode): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    { name: ALGORITHM[mode], length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function params(mode: AesMode, iv: Uint8Array): AesGcmParams | AesCbcParams | AesCtrParams {
  if (mode === 'gcm') return { name: 'AES-GCM', iv: iv as BufferSource }
  if (mode === 'cbc') return { name: 'AES-CBC', iv: iv as BufferSource }
  return { name: 'AES-CTR', counter: iv as BufferSource, length: 64 }
}

const isMode = (value: string): value is AesMode => value === 'gcm' || value === 'cbc' || value === 'ctr'

export async function encrypt(passphrase: string, plaintext: string, mode: AesMode = 'gcm'): Promise<string> {
  if (!passphrase) throw new Error('Enter a passphrase first')
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES[mode]))
  const key = await deriveKey(passphrase, salt, mode)
  const cipher = new Uint8Array(await crypto.subtle.encrypt(params(mode, iv), key, encoder.encode(plaintext)))
  const head = mode === 'gcm' ? [FORMAT_GCM] : [FORMAT_AES, mode]
  return [...head, toBase64(salt), toBase64(iv), toBase64(cipher)].join('.')
}

interface ParsedBundle {
  mode: AesMode
  salt: string
  iv: string
  cipher: string
}

/** Split a bundle, or null when it is not one of ours. */
export function parseBundle(bundle: string): ParsedBundle | null {
  const parts = bundle.trim().split('.')
  if (parts[0] === FORMAT_GCM && parts.length === 4) {
    return { mode: 'gcm', salt: parts[1], iv: parts[2], cipher: parts[3] }
  }
  if (parts[0] === FORMAT_AES && parts.length === 5 && isMode(parts[1])) {
    return { mode: parts[1], salt: parts[2], iv: parts[3], cipher: parts[4] }
  }
  return null
}

export async function decrypt(passphrase: string, bundle: string): Promise<string> {
  const parsed = parseBundle(bundle)
  if (!parsed) throw new Error('That does not look like a toolspace AES bundle')
  if (!passphrase) throw new Error('Enter a passphrase first')

  const salt = fromBase64(parsed.salt)
  const iv = fromBase64(parsed.iv)
  const cipher = fromBase64(parsed.cipher)
  const key = await deriveKey(passphrase, salt, parsed.mode)
  try {
    const plain = await crypto.subtle.decrypt(params(parsed.mode, iv), key, cipher as BufferSource)
    return decoder.decode(plain)
  } catch {
    throw new Error(
      parsed.mode === 'gcm'
        ? 'Could not decrypt — wrong passphrase or changed ciphertext'
        : 'Could not decrypt — wrong passphrase, wrong mode, or damaged ciphertext',
    )
  }
}

/** Which mode a bundle was written with, or null if it is not a bundle. */
export function bundleMode(bundle: string): AesMode | null {
  return parseBundle(bundle)?.mode ?? null
}

export function isBundle(value: string): boolean {
  return parseBundle(value) !== null
}
