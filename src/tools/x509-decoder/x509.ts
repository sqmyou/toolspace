/**
 * X.509 certificate decoding.
 *
 * A small DER reader walks the certificate structure and pulls out the fields
 * worth showing. It handles PEM or raw DER, RSA and EC keys, and the common
 * extensions. Fingerprints are computed separately because they are async.
 */

export interface Asn1Node {
  tag: number
  constructed: boolean
  start: number
  contentStart: number
  contentLength: number
  children: Asn1Node[]
}

export interface Rdn {
  attribute: string
  value: string
}

export interface PublicKeyInfo {
  algorithm: string
  keySizeBits?: number
  curve?: string
  pemLabel: string
}

export interface Certificate {
  version: number
  serialNumber: string
  signatureAlgorithm: string
  issuer: string
  issuerRdns: Rdn[]
  subject: string
  subjectRdns: Rdn[]
  notBefore: Date
  notAfter: Date
  publicKey: PublicKeyInfo
  isCa: boolean
  keyUsage: string[]
  extendedKeyUsage: string[]
  subjectAltNames: string[]
  basicConstraints?: string
  daysRemaining: number
  expired: boolean
}

export class X509Error extends Error {}

const OID_NAMES: Record<string, string> = {
  '1.2.840.113549.1.1.1': 'RSA',
  '1.2.840.113549.1.1.5': 'SHA-1 with RSA',
  '1.2.840.113549.1.1.11': 'SHA-256 with RSA',
  '1.2.840.113549.1.1.12': 'SHA-384 with RSA',
  '1.2.840.113549.1.1.13': 'SHA-512 with RSA',
  '1.2.840.113549.1.1.10': 'RSASSA-PSS',
  '1.2.840.10045.2.1': 'ECDSA',
  '1.2.840.10045.4.3.2': 'SHA-256 with ECDSA',
  '1.2.840.10045.4.3.3': 'SHA-384 with ECDSA',
  '1.2.840.10045.4.3.4': 'SHA-512 with ECDSA',
  '1.3.101.112': 'Ed25519',
  '1.3.101.113': 'Ed448',
  '1.2.840.113549.1.1.2': 'MD2 with RSA',
  '1.2.840.113549.1.1.4': 'MD5 with RSA',
  '2.5.4.3': 'CN',
  '2.5.4.6': 'C',
  '2.5.4.7': 'L',
  '2.5.4.8': 'ST',
  '2.5.4.10': 'O',
  '2.5.4.11': 'OU',
  '2.5.4.5': 'serialNumber',
  '2.5.4.9': 'street',
  '2.5.4.17': 'postalCode',
  '1.2.840.113549.1.9.1': 'emailAddress',
  '1.3.6.1.5.5.7.3.1': 'TLS Web Server Authentication',
  '1.3.6.1.5.5.7.3.2': 'TLS Web Client Authentication',
  '1.3.6.1.5.5.7.3.3': 'Code Signing',
  '1.3.6.1.5.5.7.3.4': 'Email Protection',
  '1.3.6.1.5.5.7.3.8': 'Time Stamping',
  '1.3.6.1.5.5.7.3.9': 'OCSP Signing',
}

const CURVE_NAMES: Record<string, string> = {
  '1.2.840.10045.3.1.7': 'P-256 (prime256v1)',
  '1.3.132.0.34': 'P-384 (secp384r1)',
  '1.3.132.0.35': 'P-521 (secp521r1)',
  '1.3.132.0.10': 'secp256k1',
}

const KEY_USAGE: Record<number, string> = {
  0: 'digitalSignature',
  1: 'nonRepudiation',
  2: 'keyEncipherment',
  3: 'dataEncipherment',
  4: 'keyAgreement',
  5: 'keyCertSign',
  6: 'cRLSign',
  7: 'encipherOnly',
  8: 'decipherOnly',
}

function decodeOid(bytes: Uint8Array): string {
  if (bytes.length === 0) return ''
  const parts: number[] = []
  const first = bytes[0]
  parts.push(Math.floor(first / 40), first % 40)
  let value = 0
  for (let i = 1; i < bytes.length; i++) {
    value = (value << 7) | (bytes[i] & 0x7f)
    if ((bytes[i] & 0x80) === 0) {
      parts.push(value)
      value = 0
    }
  }
  return parts.join('.')
}

/** Read one DER node beginning at `offset`. */
function readNode(bytes: Uint8Array, offset: number): { node: Asn1Node; next: number } {
  if (offset + 2 > bytes.length) throw new X509Error('Unexpected end of certificate data.')
  const tag = bytes[offset]
  const constructed = (tag & 0x20) !== 0
  let length = bytes[offset + 1]
  let cursor = offset + 2
  if (length & 0x80) {
    const count = length & 0x7f
    if (count === 0 || count > 4) throw new X509Error('Unsupported DER length encoding.')
    length = 0
    for (let i = 0; i < count; i++) length = (length << 8) | bytes[cursor + i]
    cursor += count
  }
  const contentStart = cursor
  if (contentStart + length > bytes.length) throw new X509Error('A DER node extends past the end of the data.')
  const node: Asn1Node = { tag, constructed, start: offset, contentStart, contentLength: length, children: [] }

  if (constructed) {
    let childOffset = contentStart
    const end = contentStart + length
    while (childOffset < end) {
      const { node: child, next } = readNode(bytes, childOffset)
      node.children.push(child)
      if (next <= childOffset) break
      childOffset = next
    }
  }
  return { node, next: contentStart + length }
}

function content(node: Asn1Node, bytes: Uint8Array): Uint8Array {
  return bytes.subarray(node.contentStart, node.contentStart + node.contentLength)
}

function text(node: Asn1Node, bytes: Uint8Array): string {
  return new TextDecoder().decode(content(node, bytes))
}

function parseTime(node: Asn1Node, bytes: Uint8Array): Date {
  const value = text(node, bytes)
  if (node.tag === 0x17) {
    // UTCTime: YYMMDDHHMMSSZ
    const year = Number(value.slice(0, 2))
    const fullYear = year >= 50 ? 1900 + year : 2000 + year
    return new Date(Date.UTC(fullYear, Number(value.slice(2, 4)) - 1, Number(value.slice(4, 6)), Number(value.slice(6, 8)) || 0, Number(value.slice(8, 10)) || 0, Number(value.slice(10, 12)) || 0))
  }
  // GeneralizedTime: YYYYMMDDHHMMSSZ
  return new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8)), Number(value.slice(8, 10)) || 0, Number(value.slice(10, 12)) || 0, Number(value.slice(12, 14)) || 0))
}

function parseName(node: Asn1Node, bytes: Uint8Array): Rdn[] {
  const rdns: Rdn[] = []
  for (const rdn of node.children) {
    const parts: string[] = []
    for (const attribute of rdn.children) {
      const oid = decodeOid(content(attribute.children[0], bytes))
      const name = OID_NAMES[oid] ?? oid
      parts.push(`${name}=${text(attribute.children[1], bytes)}`)
    }
    rdns.push({ attribute: parts[0].split('=')[0], value: parts.join(' + ') })
  }
  return rdns
}

function formatName(rdns: Rdn[]): string {
  return rdns.map((rdn) => rdn.value).join(', ')
}

function parseAsn1(bytes: Uint8Array): Asn1Node {
  const { node } = readNode(bytes, 0)
  return node
}

/** Read an OID node into a friendly algorithm name. */
function algorithmName(node: Asn1Node, bytes: Uint8Array): string {
  const oid = decodeOid(content(node.children[0], bytes))
  return OID_NAMES[oid] ?? oid
}

function parsePublicKey(node: Asn1Node, bytes: Uint8Array): PublicKeyInfo {
  const algorithm = node.children[0]
  const oid = decodeOid(content(algorithm.children[0], bytes))
  const name = OID_NAMES[oid] ?? oid
  const info: PublicKeyInfo = { algorithm: name, pemLabel: 'PUBLIC KEY' }

  if (name === 'RSA' && algorithm.children[1]) {
    // The parameters hold a NULL for RSA; the key itself is the BIT STRING.
    info.pemLabel = 'RSA PUBLIC KEY'
  }
  if (name === 'ECDSA' && algorithm.children[1]) {
    const curveOid = decodeOid(content(algorithm.children[1].children[0], bytes))
    info.curve = CURVE_NAMES[curveOid] ?? curveOid
  }

  const bitString = node.children[1]
  if (bitString && bitString.tag === 0x03) {
    const inner = content(bitString, bytes).subarray(1)
    if (name === 'RSA') {
      try {
        const key = parseAsn1(inner)
        const modulus = key.children[0]
        // Strip a leading zero byte that keeps the number positive.
        // `modulus` was parsed from `inner`, so index that same array.
        let length = modulus.contentLength
        if (inner[modulus.contentStart] === 0) length -= 1
        info.keySizeBits = length * 8
      } catch {
        /* leave the size undefined if the inner structure is unusual */
      }
    } else if (name === 'ECDSA' && inner[0] === 0x04) {
      const coordinateBytes = (inner.length - 1) / 2
      info.keySizeBits = coordinateBytes * 8
    }
  }
  return info
}

function parseExtensions(node: Asn1Node, bytes: Uint8Array, certificate: Partial<Certificate>): void {
  const usage: string[] = []
  const extUsage: string[] = []
  const altNames: string[] = []

  for (const extension of node.children) {
    const oid = decodeOid(content(extension.children[0], bytes))
    const valueNode = extension.children[extension.children.length - 1]
    const value = content(valueNode, bytes)

    if (oid === '2.5.29.15') {
      // KeyUsage is an OCTET STRING wrapping a BIT STRING.
      try {
        const bitsNode = parseAsn1(value)
        const bits = content(bitsNode, value).subarray(1)
        for (let i = 0; i < bits.length * 8; i++) {
          if ((bits[i >> 3] & (0x80 >> (i & 7))) !== 0 && KEY_USAGE[i]) usage.push(KEY_USAGE[i])
        }
      } catch {
        /* ignore a malformed key usage extension */
      }
    } else if (oid === '2.5.29.19' && value.length >= 2) {
      try {
        const sequence = parseAsn1(value)
        const isCa = sequence.children.some((child) => child.tag === 0x01 && content(child, value)[0] !== 0)
        const pathLength = sequence.children.find((child) => child.tag === 0x02)
        certificate.isCa = isCa
        certificate.basicConstraints = isCa
          ? `CA${pathLength ? `, path length ${content(pathLength, value)[0]}` : ', no path length limit'}`
          : 'End entity'
      } catch {
        /* ignore a malformed basic constraints extension */
      }
    } else if (oid === '2.5.29.37' && value.length >= 2) {
      try {
        const sequence = parseAsn1(value)
        for (const item of sequence.children) {
          const key = decodeOid(content(item, value))
          extUsage.push(OID_NAMES[key] ?? key)
        }
      } catch {
        /* ignore */
      }
    } else if (oid === '2.5.29.17') {
      try {
        const sequence = parseAsn1(value)
        for (const item of sequence.children) {
          if (item.tag === 0x82) altNames.push(`DNS:${text(item, value)}`)
          else if (item.tag === 0x81) altNames.push(`email:${text(item, value)}`)
          else if (item.tag === 0x86) altNames.push(`URI:${text(item, value)}`)
          else if (item.tag === 0x87) altNames.push(`IP:${[...content(item, value)].join('.')}`)
          else altNames.push(text(item, value))
        }
      } catch {
        /* ignore */
      }
    }
  }

  certificate.keyUsage = usage
  certificate.extendedKeyUsage = extUsage
  certificate.subjectAltNames = altNames
}

export function parseCertificate(input: Uint8Array, now: number = Date.now()): Certificate {
  const der = input
  if (der.length < 64) throw new X509Error('The certificate data is too short.')
  const root = parseAsn1(der)
  if (root.tag !== 0x30 || root.children.length < 3) throw new X509Error('This does not look like a DER certificate.')
  const tbs = root.children[0]

  const certificate: Partial<Certificate> = { isCa: false, keyUsage: [], extendedKeyUsage: [], subjectAltNames: [] }
  let index = 0
  let version = 1
  if (tbs.children[index]?.tag === 0xa0) {
    version = content(tbs.children[index].children[0], der)[0] + 1
    index += 1
  }
  certificate.version = version
  certificate.serialNumber = [...content(tbs.children[index++], der)].map((byte) => byte.toString(16).padStart(2, '0')).join(':')
  certificate.signatureAlgorithm = algorithmName(tbs.children[index++], der)
  certificate.issuerRdns = parseName(tbs.children[index++], der)
  certificate.issuer = formatName(certificate.issuerRdns)

  const validity = tbs.children[index++]
  certificate.notBefore = parseTime(validity.children[0], der)
  certificate.notAfter = parseTime(validity.children[1], der)

  certificate.subjectRdns = parseName(tbs.children[index++], der)
  certificate.subject = formatName(certificate.subjectRdns)
  certificate.publicKey = parsePublicKey(tbs.children[index++], der)

  // Optional issuerUniqueID / subjectUniqueID then extensions [3].
  while (index < tbs.children.length) {
    const node = tbs.children[index++]
    if (node.tag === 0xa3) parseExtensions(node.children[0], der, certificate)
  }

  const daysRemaining = Math.floor((certificate.notAfter!.getTime() - now) / 86_400_000)
  return {
    ...(certificate as Certificate),
    daysRemaining,
    expired: certificate.notAfter!.getTime() < now,
  }
}

/** Convert PEM text to DER bytes. */
export function pemToDer(pem: string): Uint8Array {
  const match = /-----BEGIN [^-]+-----\s*([\s\S]*?)\s*-----END [^-]+-----/.exec(pem)
  const base64 = (match ? match[1] : pem).replace(/\s+/g, '')
  if (!base64) throw new X509Error('No PEM block or DER data found.')
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    throw new X509Error('The PEM body is not valid Base64.')
  }
}

export function derToPem(bytes: Uint8Array, label = 'CERTIFICATE'): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const base64 = btoa(binary).replace(/(.{64})/g, '$1\n')
  return `-----BEGIN ${label}-----\n${base64}\n-----END ${label}-----`
}

export async function fingerprints(bytes: Uint8Array): Promise<{ sha1: string; sha256: string }> {
  const digest = async (algorithm: 'SHA-1' | 'SHA-256') => {
    const bits = await crypto.subtle.digest(algorithm, bytes as BufferSource)
    return [...new Uint8Array(bits)].map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(':')
  }
  return { sha1: await digest('SHA-1'), sha256: await digest('SHA-256') }
}
