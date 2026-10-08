import { describe, expect, it } from 'vitest'
import { decodeEntities, escapeXmlAttr, escapeXmlText, jsonToXml, parseXml, XmlError, xmlToJson } from './xml'

describe('escape helpers', () => {
  it('escapes text and attribute characters', () => {
    expect(escapeXmlText('a & b < c')).toBe('a &amp; b &lt; c')
    expect(escapeXmlAttr('a "b" & c')).toBe('a &quot;b&quot; &amp; c')
  })

  it('decodes named, decimal and hex entities', () => {
    expect(decodeEntities('a &amp; b &lt; &gt; &quot; &apos;')).toBe(`a & b < > " '`)
    expect(decodeEntities('&#65;&#x42;')).toBe('AB')
  })

  it('leaves unknown entities alone', () => {
    expect(decodeEntities('&nope;')).toBe('&nope;')
  })
})

describe('parseXml', () => {
  it('parses elements, attributes and text', () => {
    const root = parseXml('<a x="1"><b>hi</b><b>yo</b></a>')
    expect(root.tag).toBe('a')
    expect(root.attrs.x).toBe('1')
    expect(root.children).toHaveLength(2)
  })

  it('skips declarations and comments', () => {
    const root = parseXml('<?xml version="1.0"?>\n<!-- note -->\n<a>ok</a>')
    expect(root.tag).toBe('a')
  })

  it('reads CDATA as literal text', () => {
    const root = parseXml('<a><![CDATA[<not a tag>]]></a>')
    expect(root.children[0]).toEqual({ text: '<not a tag>' })
  })

  it('handles self-closing elements', () => {
    const root = parseXml('<a><b/></a>')
    expect((root.children[0] as { tag: string }).tag).toBe('b')
  })

  it('throws on mismatched tags', () => {
    expect(() => parseXml('<a><b></a>')).toThrow(XmlError)
  })

  it('throws on unterminated elements', () => {
    expect(() => parseXml('<a><b>')).toThrow(XmlError)
  })

  it('throws on content after the root', () => {
    expect(() => parseXml('<a/><b/>')).toThrow(XmlError)
  })

  it('throws on unquoted attributes', () => {
    expect(() => parseXml('<a x=1/>')).toThrow(XmlError)
  })
})

describe('xmlToJson', () => {
  it('turns a leaf element into a string', () => {
    expect(xmlToJson(parseXml('<a>hi</a>'))).toBe('hi')
  })

  it('groups repeated tags into an array', () => {
    expect(xmlToJson(parseXml('<a><b>1</b><b>2</b></a>'))).toEqual({ b: ['1', '2'] })
  })

  it('keeps attributes under @ keys', () => {
    expect(xmlToJson(parseXml('<a x="1"><b>2</b></a>'))).toEqual({ '@x': '1', b: '2' })
  })

  it('uses #text when attributes and text mix', () => {
    expect(xmlToJson(parseXml('<a x="1">hello</a>'))).toEqual({ '@x': '1', '#text': 'hello' })
  })
})

describe('jsonToXml', () => {
  it('serialises a simple object, inlining a single child', () => {
    expect(jsonToXml({ a: { b: '1' } })).toBe('<a><b>1</b></a>')
  })

  it('serialises arrays as repeated elements', () => {
    expect(jsonToXml({ root: { item: ['a', 'b'] } })).toBe('<root>\n  <item>a</item>\n  <item>b</item>\n</root>')
  })

  it('serialises attributes from @ keys', () => {
    expect(jsonToXml({ a: { '@x': '1', b: '2' } })).toBe('<a x="1"><b>2</b></a>')
  })

  it('indents when there is more than one child', () => {
    expect(jsonToXml({ a: { b: '1', c: '2' } })).toBe('<a>\n  <b>1</b>\n  <c>2</c>\n</a>')
  })

  it('escapes text', () => {
    expect(jsonToXml({ a: 'x & y' })).toBe('<a>x &amp; y</a>')
  })

  it('round-trips a document', () => {
    const json = xmlToJson(parseXml('<a x="1"><b>hi</b></a>'))
    const xml = jsonToXml({ a: json })
    expect(xmlToJson(parseXml(xml))).toEqual(json)
  })
})
