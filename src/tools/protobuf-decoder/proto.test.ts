import { describe, expect, it } from 'vitest'
import { decodeProtobuf, formatFields, parsePayload, ProtobufError } from './proto'

function hex(text: string): Uint8Array {
  const out = new Uint8Array(text.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(text.slice(i * 2, i * 2 + 2), 16)
  return out
}

describe('parsePayload', () => {
  it('reads hex, ignoring spaces', () => {
    expect(Array.from(parsePayload('08 96 01'))).toEqual([8, 150, 1])
  })

  it('reads base64', () => {
    // "hi" in base64 is aGk=
    expect(Array.from(parsePayload('aGk='))).toEqual([104, 105])
  })

  it('rejects junk', () => {
    expect(() => parsePayload('not$hex!')).toThrow(ProtobufError)
  })

  it('returns empty bytes for empty input', () => {
    expect(parsePayload('  ').length).toBe(0)
  })
})

describe('decodeProtobuf', () => {
  it('decodes a varint field', () => {
    const fields = decodeProtobuf(hex('089601'))
    expect(fields).toHaveLength(1)
    expect(fields[0].number).toBe(1)
    expect(fields[0].wireName).toBe('varint')
    expect(fields[0].value).toContain('150')
  })

  it('decodes a string field', () => {
    const fields = decodeProtobuf(hex('12026869'))
    expect(fields[0].value).toBe('hi')
  })

  it('decodes a nested message', () => {
    const fields = decodeProtobuf(hex('1a020801'))
    expect(fields[0].children).toHaveLength(1)
    expect(fields[0].children![0].number).toBe(1)
  })

  it('decodes a packed repeated field', () => {
    const fields = decodeProtobuf(hex('2203010203'))
    expect(fields[0].packed).toEqual([1, 2, 3])
  })

  it('decodes fixed32', () => {
    const fields = decodeProtobuf(hex('2d01020304'))
    expect(fields[0].wireName).toBe('fixed32')
    expect(fields[0].value).toBe('0x01020304')
  })

  it('reports the signed interpretation of a varint', () => {
    const fields = decodeProtobuf(hex('0801'))
    expect(fields[0].value).toContain('sint')
  })

  it('throws on empty input', () => {
    expect(() => decodeProtobuf(new Uint8Array())).toThrow(ProtobufError)
  })

  it('throws when a length runs past the end', () => {
    expect(() => decodeProtobuf(hex('120a6869'))).toThrow(ProtobufError)
  })

  it('throws on an unsupported wire type', () => {
    // Field 1, wire type 3 (start-group) is not handled.
    expect(() => decodeProtobuf(hex('0b'))).toThrow(ProtobufError)
  })
})

describe('formatFields', () => {
  it('indents nested fields', () => {
    const text = formatFields(decodeProtobuf(hex('1a020801')))
    expect(text.split('\n')).toHaveLength(2)
    expect(text.split('\n')[1].startsWith('  ')).toBe(true)
  })
})
