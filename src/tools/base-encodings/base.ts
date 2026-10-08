/** Base32 (RFC 4648), Base58 (Bitcoin) and hex/binary codecs, all over bytes. */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

export function bytesFromText(text: string): Uint8Array {
  return textEncoder.encode(text)
}

export function textFromBytes(bytes: Uint8Array): string {
  return textDecoder.decode(bytes)
}

export function toHex(bytes: Uint8Array, upper = false): string {
  const out = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return upper ? out.toUpperCase() : out
}

export function fromHex(input: string): Uint8Array {
  const clean = input.replace(/[\s:]/g, '')
  if (clean.length % 2 !== 0) throw new Error('Hex input must have an even number of digits')
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    const byte = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
    if (Number.isNaN(byte)) throw new Error('Hex input contains non-hex characters')
    bytes[i] = byte
  }
  return bytes
}

export function toBinary(bytes: Uint8Array, group = 8): string {
  const bits = [...bytes].map((b) => b.toString(2).padStart(8, '0')).join('')
  if (group <= 0 || group === 8) return bits
  return bits.replace(new RegExp(`.{1,${group}}`, 'g'), (chunk) => chunk.padEnd(group, '0')).replace(/(\S)(?=\S)/g, '$1 ')
}

export function fromBinary(input: string): Uint8Array {
  const bits = input.replace(/[^01]/g, '')
  if (bits.length % 8 !== 0) throw new Error('Binary input must be a multiple of 8 bits')
  const bytes = new Uint8Array(bits.length / 8)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2)
  return bytes
}

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  while (output.length % 8 !== 0) output += '='
  return output
}

export function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/[=\s]/g, '').toUpperCase()
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) throw new Error(`Invalid Base32 character "${char}"`)
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(bytes)
}

export function base58Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return ''
  const digits: number[] = [0]
  for (const byte of bytes) {
    let carry = byte
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8
      digits[i] = carry % 58
      carry = (carry / 58) | 0
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = (carry / 58) | 0
    }
  }
  let output = ''
  for (const byte of bytes) {
    if (byte === 0) output += BASE58_ALPHABET[0]
    else break
  }
  for (let i = digits.length - 1; i >= 0; i--) output += BASE58_ALPHABET[digits[i]]
  return output
}

export function base58Decode(input: string): Uint8Array {
  if (input.length === 0) return new Uint8Array()
  const bytes: number[] = [0]
  for (const char of input) {
    const index = BASE58_ALPHABET.indexOf(char)
    if (index === -1) throw new Error(`Invalid Base58 character "${char}"`)
    let carry = index
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58
      bytes[i] = carry & 0xff
      carry >>= 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }
  for (const char of input) {
    if (char === BASE58_ALPHABET[0]) bytes.push(0)
    else break
  }
  return new Uint8Array(bytes.reverse())
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return new Uint8Array(digest)
}

/** Base58Check: payload + first 4 bytes of double SHA-256, Base58-encoded. */
export async function base58CheckEncode(payload: Uint8Array): Promise<string> {
  const first = await sha256(payload)
  const second = await sha256(first)
  const combined = new Uint8Array(payload.length + 4)
  combined.set(payload, 0)
  combined.set(second.slice(0, 4), payload.length)
  return base58Encode(combined)
}

export async function base58CheckDecode(input: string): Promise<Uint8Array> {
  const decoded = base58Decode(input)
  if (decoded.length < 5) throw new Error('Base58Check value is too short')
  const payload = decoded.slice(0, decoded.length - 4)
  const checksum = decoded.slice(decoded.length - 4)
  const first = await sha256(payload)
  const second = await sha256(first)
  for (let i = 0; i < 4; i++) {
    if (checksum[i] !== second[i]) throw new Error('Base58Check checksum does not match')
  }
  return payload
}
