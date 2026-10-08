import { describe, expect, it } from 'vitest'
import { hash, HashError, hmac, md5 } from './hash'

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

describe('md5', () => {
  it('matches the empty-string vector', () => {
    expect(hex(md5(new Uint8Array()))).toBe('d41d8cd98f00b204e9800998ecf8427e')
  })

  it('matches the "abc" vector', () => {
    expect(hex(md5(new TextEncoder().encode('abc')))).toBe('900150983cd24fb0d6963f7d28e17f72')
  })

  it('matches a longer vector', () => {
    const text = 'The quick brown fox jumps over the lazy dog'
    expect(hex(md5(new TextEncoder().encode(text)))).toBe('9e107d9d372bb6826bd81d3542a419d6')
  })

  it('matches a multi-block vector', () => {
    const text = 'a'.repeat(1000)
    expect(hex(md5(new TextEncoder().encode(text)))).toBe('cabe45dcc9ae5b66ba86600cca6b8ba8')
  })
})

describe('hash', () => {
  it('hashes SHA-1', async () => {
    expect(await hash('abc', 'SHA-1')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
  })

  it('hashes SHA-256 of "abc"', async () => {
    expect(await hash('abc', 'SHA-256')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('hashes SHA-256 of the empty string', async () => {
    expect(await hash('', 'SHA-256')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('hashes SHA-512', async () => {
    const expected =
      'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a' +
      '2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f'
    expect(await hash('abc', 'SHA-512')).toBe(expected)
  })

  it('hashes MD5 through the same entry point', async () => {
    expect(await hash('abc', 'MD5')).toBe('900150983cd24fb0d6963f7d28e17f72')
  })

  it('can return base64', async () => {
    // base64 of the raw SHA-256 digest of "abc"
    expect(await hash('abc', 'SHA-256', 'base64')).toBe('ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=')
  })

  it('handles unicode input consistently', async () => {
    const a = await hash('héllo 世界', 'SHA-256')
    const b = await hash('héllo 世界', 'SHA-256')
    expect(a).toBe(b)
    expect(a).toHaveLength(64)
  })
})

describe('hmac', () => {
  it('matches the RFC-style SHA-256 vector', async () => {
    const result = await hmac('The quick brown fox jumps over the lazy dog', 'key', 'SHA-256')
    expect(result).toBe('f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8')
  })

  it('changes when the key changes', async () => {
    const a = await hmac('message', 'key-one', 'SHA-256')
    const b = await hmac('message', 'key-two', 'SHA-256')
    expect(a).not.toBe(b)
  })

  it('requires a secret', async () => {
    await expect(hmac('message', '', 'SHA-256')).rejects.toThrow(HashError)
  })
})
