import { describe, expect, it } from 'vitest'
import { dnsQueryUrl, normalizeDomain, parseDnsResponse } from './dns'

describe('normalizeDomain', () => {
  it('lowercases and trims', () => {
    expect(normalizeDomain('  Example.COM ')).toBe('example.com')
  })

  it('strips a scheme and path so a pasted URL works', () => {
    expect(normalizeDomain('https://example.com/some/path?q=1')).toBe('example.com')
    expect(normalizeDomain('http://sub.example.com.')).toBe('sub.example.com')
  })

  it('keeps subdomains and underscores', () => {
    expect(normalizeDomain('_dmarc.example.com')).toBe('_dmarc.example.com')
  })

  it('rejects empty input', () => {
    expect(() => normalizeDomain('   ')).toThrow(/Enter a domain/)
  })

  it('rejects characters that are not hostname-safe', () => {
    expect(() => normalizeDomain('exa mple.com')).toThrow(/letters, digits/)
    expect(() => normalizeDomain('exa<mple>.com')).toThrow(/letters, digits/)
  })

  it('drops a path or query rather than rejecting a pasted URL', () => {
    expect(normalizeDomain('example.com/evil?x=<script>')).toBe('example.com')
  })

  it('rejects names that start or end with a hyphen or dot, or double dots', () => {
    expect(() => normalizeDomain('-example.com')).toThrow(/not a valid domain/)
    expect(() => normalizeDomain('example..com')).toThrow(/not a valid domain/)
  })

  it('rejects an over-long name', () => {
    expect(() => normalizeDomain(`${'a'.repeat(254)}.com`)).toThrow(/longer than/)
  })
})

describe('parseDnsResponse', () => {
  it('reads a NOERROR answer', () => {
    const result = parseDnsResponse({
      Status: 0,
      Answer: [
        { name: 'example.com.', type: 1, TTL: 238, data: '104.20.23.154' },
        { name: 'example.com.', type: 28, TTL: 238, data: '2606:4700::6814:179a' },
      ],
    })
    expect(result.ok).toBe(true)
    expect(result.status).toBe('NOERROR')
    expect(result.answers).toHaveLength(2)
    expect(result.answers[0]).toMatchObject({ type: 'A', data: '104.20.23.154', ttl: 238 })
    expect(result.answers[1].type).toBe('AAAA')
  })

  it('names an NXDOMAIN and explains it', () => {
    const result = parseDnsResponse({ Status: 3 })
    expect(result.ok).toBe(false)
    expect(result.status).toBe('NXDOMAIN')
    expect(result.message).toBe('The name does not exist.')
    expect(result.answers).toEqual([])
  })

  it('surfaces a resolver comment when there is one', () => {
    const result = parseDnsResponse({ Status: 2, Comment: 'Resolver busy' })
    expect(result.status).toBe('SERVFAIL')
    expect(result.message).toBe('Resolver busy')
  })

  it('handles an unknown rcode and unknown type without throwing', () => {
    const result = parseDnsResponse({ Status: 99, Answer: [{ name: 'x.', type: 999, TTL: 1, data: 'v' }] })
    expect(result.status).toBe('RCODE 99')
    expect(result.answers[0].type).toBe('TYPE999')
  })

  it('tolerates junk entries and non-object payloads', () => {
    expect(parseDnsResponse(null).ok).toBe(false)
    const result = parseDnsResponse({ Status: 0, Answer: [null, 'nope', { name: 'a.', type: 1, TTL: 5, data: '1.2.3.4' }] })
    expect(result.answers).toHaveLength(1)
  })
})

describe('dnsQueryUrl', () => {
  it('encodes the name and includes the type', () => {
    expect(dnsQueryUrl('example.com', 'MX')).toBe('https://dns.google/resolve?name=example.com&type=MX')
    expect(dnsQueryUrl('a b', 'TXT')).toContain('name=a%20b')
  })
})
