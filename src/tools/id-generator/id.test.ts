import { describe, expect, it } from 'vitest'
import { generate, generateMany, hexId, nanoid, objectId, ulid, uuidV4, uuidV7 } from './id'

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
