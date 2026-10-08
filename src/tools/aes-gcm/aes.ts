/**
 * Passphrase-based AES-GCM encryption using WebCrypto.
 *
 * The output bundle is `tsgcm1.<base64 salt>.<base64 iv>.<base64 ciphertext>`
 * so everything needed to decrypt travels with the message. The key is derived
 * with PBKDF2-SHA256 and a random per-message salt.
 */

const FORMAT = 'tsgcm1'
const SALT_BYTES = 16
const IV_BYTES = 12
const ITERATIONS = 250_000

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

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encrypt(passphrase: string, plaintext: string): Promise<string> {
  if (!passphrase) throw new Error('Enter a passphrase first')
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(passphrase, salt)
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, encoder.encode(plaintext)),
  )
  return [FORMAT, toBase64(salt), toBase64(iv), toBase64(cipher)].join('.')
}

export async function decrypt(passphrase: string, bundle: string): Promise<string> {
  const parts = bundle.trim().split('.')
  if (parts.length !== 4 || parts[0] !== FORMAT) {
    throw new Error('That does not look like a toolspace AES bundle')
  }
  const [, saltB64, ivB64, cipherB64] = parts
  const salt = fromBase64(saltB64)
  const iv = fromBase64(ivB64)
  const cipher = fromBase64(cipherB64)
  const key = await deriveKey(passphrase, salt)
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, cipher as BufferSource)
    return decoder.decode(plain)
  } catch {
    throw new Error('Could not decrypt — wrong passphrase or changed ciphertext')
  }
}

export function isBundle(value: string): boolean {
  return value.trim().startsWith(`${FORMAT}.`)
}
