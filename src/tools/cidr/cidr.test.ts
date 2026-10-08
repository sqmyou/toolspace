import { describe, expect, it } from 'vitest'
import { computeSubnet, formatIPv4, formatIPv6, parseCidr, parseIPv4, parseIPv6 } from './cidr'

describe('IPv4 parsing', () => {
  it('round-trips', () => {
    expect(parseIPv4('192.168.1.1')).toBe(0xc0a80101)
    expect(formatIPv4(0xc0a80101)).toBe('192.168.1.1')
    expect(formatIPv4(0)).toBe('0.0.0.0')
    expect(formatIPv4(0xffffffff)).toBe('255.255.255.255')
  })

  it('rejects malformed input', () => {
    expect(() => parseIPv4('1.2.3')).toThrow()
    expect(() => parseIPv4('1.2.3.256')).toThrow()
    expect(() => parseIPv4('a.b.c.d')).toThrow()
  })
})

describe('IPv6 parsing', () => {
  it('expands and compresses', () => {
    expect(parseIPv6('::1')).toBe(1n)
    expect(parseIPv6('::')).toBe(0n)
    expect(formatIPv6(parseIPv6('2001:0db8:0000:0000:0000:0000:0000:0001'))).toBe('2001:db8::1')
    expect(formatIPv6(0n)).toBe('::')
  })

  it('handles embedded IPv4', () => {
    expect(formatIPv6(parseIPv6('::ffff:192.168.1.1'))).toBe('::ffff:c0a8:101')
  })

  it('rejects bad group counts', () => {
    expect(() => parseIPv6('1:2:3')).toThrow()
    expect(() => parseIPv6('::1::2')).toThrow()
  })
})

describe('parseCidr', () => {
  it('defaults the prefix to the address width', () => {
    expect(parseCidr('10.0.0.1').prefix).toBe(32)
    expect(parseCidr('::1').prefix).toBe(128)
  })

  it('rejects out-of-range prefixes', () => {
    expect(() => parseCidr('10.0.0.1/33')).toThrow()
    expect(() => parseCidr('::1/129')).toThrow()
  })
})

describe('computeSubnet (IPv4)', () => {
  it('computes a /24', () => {
    const info = computeSubnet('192.168.1.10/24')
    expect(info.network).toBe('192.168.1.0')
    expect(info.broadcast).toBe('192.168.1.255')
    expect(info.first).toBe('192.168.1.1')
    expect(info.last).toBe('192.168.1.254')
    expect(info.netmask).toBe('255.255.255.0')
    expect(info.wildcard).toBe('0.0.0.255')
    expect(info.hostCount).toBe('256')
    expect(info.isPrivate).toBe(true)
  })

  it('treats /31 and /32 as host ranges', () => {
    const p31 = computeSubnet('10.0.0.0/31')
    expect(p31.first).toBe('10.0.0.0')
    expect(p31.last).toBe('10.0.0.1')
    expect(p31.hostCount).toBe('2')

    const p32 = computeSubnet('8.8.8.8/32')
    expect(p32.hostCount).toBe('1')
    expect(p32.isPrivate).toBe(false)
  })

  it('handles a /0', () => {
    const info = computeSubnet('0.0.0.0/0')
    expect(info.netmask).toBe('0.0.0.0')
    expect(info.broadcast).toBe('255.255.255.255')
    expect(info.hostCount).toBe('4294967296')
  })
})

describe('computeSubnet (IPv6)', () => {
  it('computes a /32 with the full host count', () => {
    const info = computeSubnet('2001:db8::1/32')
    expect(info.network).toBe('2001:db8::')
    expect(info.prefix).toBe(32)
    expect(info.hostCount).toBe((2n ** 96n).toString())
    expect(info.last.startsWith('2001:db8:')).toBe(true)
  })

  it('flags unique-local addresses', () => {
    expect(computeSubnet('fd00::/8').isPrivate).toBe(true)
    expect(computeSubnet('2001:db8::/32').isPrivate).toBe(false)
  })
})
