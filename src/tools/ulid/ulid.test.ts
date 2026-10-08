import { describe, expect, it } from 'vitest'
import { decodeUlid, isUuid, UlidError, ulid, uuidV4, uuidVersion } from './ulid'

describe('ulid', () => {
  it('produces 26 characters from the Crockford alphabet', () => {
    const id = ulid()
    expect(id).toHaveLength(26)
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
  })

  it('encodes the timestamp so ids sort by creation time', () => {
    const early = ulid(1_000_000_000_000)
    const later = ulid(1_000_000_000_001)
    expect(early.slice(0, 10) < later.slice(0, 10)).toBe(true)
    expect(decodeUlid(early).timestamp).toBe(1_000_000_000_000)
  })

  it('round-trips a known timestamp', () => {
    const time = Date.UTC(2024, 0, 1)
    const decoded = decodeUlid(ulid(time))
    expect(decoded.time.getTime()).toBe(time)
  })

  it('varies the random part between calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => ulid(1_700_000_000_000)))
    expect(ids.size).toBe(50)
  })

  it('accepts lookalike characters when decoding', () => {
    const id = ulid(1_700_000_000_000)
    const swapped = id.replace(/0/g, 'O').replace(/1/g, 'I')
    expect(decodeUlid(swapped).timestamp).toBe(1_700_000_000_000)
  })

  it('rejects a bad length or character', () => {
    expect(() => decodeUlid('ABC')).toThrow(UlidError)
    expect(() => decodeUlid('U'.repeat(26))).toThrow(UlidError)
  })

  it('rejects an out-of-range timestamp', () => {
    expect(() => ulid(-1)).toThrow(UlidError)
    expect(() => ulid(2 ** 48)).toThrow(UlidError)
  })
})

describe('uuidV4', () => {
  it('matches the v4 shape', () => {
    for (let i = 0; i < 20; i++) {
      const id = uuidV4()
      expect(isUuid(id)).toBe(true)
      expect(uuidVersion(id)).toBe(4)
      expect(id[14]).toBe('4')
      expect('89ab').toContain(id[19])
    }
  })

  it('does not repeat', () => {
    const ids = new Set(Array.from({ length: 100 }, uuidV4))
    expect(ids.size).toBe(100)
  })
})

describe('isUuid', () => {
  it('accepts hyphenated and compact forms', () => {
    expect(isUuid('00000000-0000-4000-8000-000000000000')).toBe(true)
    expect(isUuid('00000000000040008000000000000000')).toBe(true)
  })

  it('rejects non-uuids', () => {
    expect(isUuid('not-a-uuid')).toBe(false)
    expect(isUuid('00000000-0000-0000-0000-000000000000')).toBe(false)
  })
})

describe('uuidVersion', () => {
  it('reads the version digit', () => {
    expect(uuidVersion('123e4567-e89b-12d3-a456-426614174000')).toBe(1)
    expect(uuidVersion('nope')).toBeNull()
  })
})
