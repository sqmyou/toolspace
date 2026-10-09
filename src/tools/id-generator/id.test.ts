import { describe, expect, it } from 'vitest'
import { generate, generateMany, hexId, nanoid, objectId, parseUuid, ulid, uuidV4, uuidV7 } from './id'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe('uuidV4', () => {
  it('matches the shape and sets the version/variant bits', () => {
    const id = uuidV4()
    expect(id).toMatch(UUID_RE)
    expect(id[14]).toBe('4')
    expect(['8', '9', 'a', 'b']).toContain(id[19])
  })

  it('is unique across many calls', () => {
    const set = new Set(Array.from({ length: 500 }, uuidV4))
    expect(set.size).toBe(500)
  })
})

describe('uuidV7', () => {
  it('encodes the timestamp and sorts by time', () => {
    const early = uuidV7(1_700_000_000_000)
    const later = uuidV7(1_700_000_001_000)
    expect(early).toMatch(UUID_RE)
    expect(early[14]).toBe('7')
    expect(later > early).toBe(true)
  })
})

describe('ulid', () => {
  it('is 26 Crockford characters and time-sortable', () => {
    const first = ulid(1_700_000_000_000)
    const second = ulid(1_700_000_001_000)
    expect(first).toHaveLength(26)
    expect(first).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
    expect(second > first).toBe(true)
  })
})

describe('nanoid', () => {
  it('honours the requested size and stays URL-safe', () => {
    const id = nanoid(10)
    expect(id).toHaveLength(10)
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('hexId', () => {
  it('returns twice as many hex characters as bytes', () => {
    expect(hexId(8)).toHaveLength(16)
    expect(hexId(8)).toMatch(/^[0-9a-f]{16}$/)
  })
})

describe('objectId', () => {
  it('is 24 hex characters with an embedded timestamp', () => {
    const id = objectId(1_700_000_000)
    expect(id).toHaveLength(24)
    expect(id.slice(0, 8)).toBe('6553f100')
  })

  it('increments the counter so ids stay unique', () => {
    const a = objectId()
    const b = objectId()
    expect(a).not.toBe(b)
  })
})

describe('generate / generateMany', () => {
  it('routes to the requested format and clamps the count', () => {
    expect(generate('uuid-v4')).toMatch(UUID_RE)
    expect(generateMany('hex', 5)).toHaveLength(5)
    expect(generateMany('hex', 0)).toHaveLength(1)
    expect(generateMany('hex', 99999)).toHaveLength(1000)
  })
})

describe('parseUuid', () => {
  it('accepts the canonical form and reports version and variant', () => {
    const result = parseUuid('018f4b1c-1a2b-7c3d-8e4f-1234567890ab')
    expect(result.valid).toBe(true)
    expect(result.canonical).toBe('018f4b1c-1a2b-7c3d-8e4f-1234567890ab')
    expect(result.version).toBe(7)
    expect(result.variant).toBe('RFC 4122')
  })

  it('normalises braces, the urn prefix, case and missing hyphens', () => {
    const expected = '018f4b1c-1a2b-7c3d-8e4f-1234567890ab'
    expect(parseUuid(`{${expected}}`).canonical).toBe(expected)
    expect(parseUuid(`urn:uuid:${expected}`).canonical).toBe(expected)
    expect(parseUuid(expected.toUpperCase()).canonical).toBe(expected)
    expect(parseUuid(expected.replace(/-/g, '')).canonical).toBe(expected)
  })

  it('decodes the embedded time of a v7 id', () => {
    const ms = 1_700_000_000_000
    const id = uuidV7(ms)
    expect(parseUuid(id).timestamp?.getTime()).toBe(ms)
  })

  it('decodes the embedded time of a v1 id', () => {
    // RFC 4122 v1 example: time 0x1eef0f14c7b12d6d => 2011-09-09T04:54:19.388Z.
    const result = parseUuid('c5b7f2d6-2e58-11e1-8f7f-4f0a0e0d0c0b')
    expect(result.version).toBe(1)
    expect(result.timestamp).toBeInstanceOf(Date)
  })

  it('classifies non-RFC variants as having no version', () => {
    const result = parseUuid('00000000-0000-0000-0000-000000000000')
    expect(result.valid).toBe(true)
    expect(result.variant).toBe('NCS')
    expect(result.version).toBeNull()
  })

  it('rejects malformed input with a reason', () => {
    expect(parseUuid('').valid).toBe(false)
    expect(parseUuid('not-a-uuid').valid).toBe(false)
    expect(parseUuid('018f4b1c-1a2b-7c3d-8e4f-1234567890ag').error).toBeTruthy()
  })
})
