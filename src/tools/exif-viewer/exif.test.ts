import { describe, expect, it } from 'vitest'
import { ExifError, gpsToDecimal, groupEntries, parseExif } from './exif'

/** Build a bare little-endian TIFF with a single ASCII tag. */
function tinyTiff(): Uint8Array {
  const bytes = new Uint8Array(32)
  // II, magic 42, IFD0 offset 8
  bytes.set([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00], 0)
  // One entry
  bytes.set([0x01, 0x00], 8)
  // Make (0x010f), ASCII (2), count 6, value offset 26
  bytes.set([0x0f, 0x01, 0x02, 0x00, 0x06, 0x00, 0x00, 0x00, 0x1a, 0x00, 0x00, 0x00], 10)
  // Next IFD offset = 0
  bytes.set([0x00, 0x00, 0x00, 0x00], 22)
  // "Canon\0"
  bytes.set([0x43, 0x61, 0x6e, 0x6f, 0x6e, 0x00], 26)
  return bytes
}

describe('parseExif', () => {
  it('reads a tag from a bare TIFF', () => {
    const result = parseExif(tinyTiff())
    expect(result.format).toBe('tiff')
    expect(result.byteOrder).toBe('little')
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].name).toBe('Make')
    expect(result.entries[0].value).toBe('Canon')
    expect(result.entries[0].group).toBe('IFD0')
  })

  it('rejects a file that is too small', () => {
    expect(() => parseExif(new Uint8Array([1, 2, 3]))).toThrow(ExifError)
  })

  it('rejects an unrecognised container', () => {
    const bytes = new Uint8Array(16)
    bytes.fill(0x41)
    expect(() => parseExif(bytes)).toThrow(ExifError)
  })

  it('reports a JPEG without EXIF', () => {
    // SOI then EOI, padded past the minimum length.
    expect(() => parseExif(new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0, 0, 0, 0]))).toThrow(/No EXIF data/)
  })
})

describe('groupEntries', () => {
  it('keeps group order and buckets entries', () => {
    const grouped = groupEntries([
      { group: 'IFD0', tag: 1, name: 'A', value: '1' },
      { group: 'EXIF', tag: 2, name: 'B', value: '2' },
      { group: 'IFD0', tag: 3, name: 'C', value: '3' },
    ])
    expect(grouped.map((g) => g.group)).toEqual(['IFD0', 'EXIF'])
    expect(grouped[0].entries).toHaveLength(2)
  })
})

describe('gpsToDecimal', () => {
  it('converts degrees/minutes/seconds', () => {
    expect(gpsToDecimal('N', [51, 30, 0])).toBeCloseTo(51.5, 5)
  })

  it('negates southern and western coordinates', () => {
    expect(gpsToDecimal('S', [10, 0, 0])).toBeCloseTo(-10, 5)
    expect(gpsToDecimal('W', [10, 0, 0])).toBeCloseTo(-10, 5)
  })

  it('returns NaN without three components', () => {
    expect(Number.isNaN(gpsToDecimal('N', [1, 2]))).toBe(true)
  })
})
