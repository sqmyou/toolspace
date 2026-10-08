/** Asymmetric key pair generation and PEM export via WebCrypto. */

export type Algorithm = 'RSA-2048' | 'RSA-4096' | 'ECDSA-P256' | 'ECDSA-P384' | 'Ed25519'

export interface KeyPairPem {
  publicKey: string
  privateKey: string
  algorithm: Algorithm
}

function pemFromDer(der: ArrayBuffer, label: string): string {
  const bytes = new Uint8Array(der)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const base64 = btoa(binary)
  const lines = base64.match(/.{1,64}/g) ?? []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

function params(algorithm: Algorithm): { gen: RsaHashedKeyGenParams | EcKeyGenParams | { name: string }; usages: KeyUsage[] } {
  switch (algorithm) {
    case 'RSA-2048':
    case 'RSA-4096':
      return {
        gen: {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: algorithm === 'RSA-2048' ? 2048 : 4096,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        usages: ['sign', 'verify'],
      }
    case 'ECDSA-P256':
    case 'ECDSA-P384':
      return {
        gen: { name: 'ECDSA', namedCurve: algorithm === 'ECDSA-P256' ? 'P-256' : 'P-384' },
        usages: ['sign', 'verify'],
      }
    case 'Ed25519':
      return { gen: { name: 'Ed25519' }, usages: ['sign', 'verify'] }
  }
}

export async function generateKeyPair(algorithm: Algorithm): Promise<KeyPairPem> {
  const { gen, usages } = params(algorithm)
  const pair = (await crypto.subtle.generateKey(gen as AlgorithmIdentifier, true, usages)) as CryptoKeyPair

  const spki = await crypto.subtle.exportKey('spki', pair.publicKey)
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey)

  return {
    algorithm,
    publicKey: pemFromDer(spki, 'PUBLIC KEY'),
    privateKey: pemFromDer(pkcs8, 'PRIVATE KEY'),
  }
}
