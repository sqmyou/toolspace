/**
 * JSON <-> XML conversion.
 *
 * A small, dependency-free XML reader and writer live here rather than in the
 * tool's UI, so both directions can be tested in Node without a DOM. The
 * reader only needs to handle well-formed documents; it is not a validator.
 */

export interface XmlNode {
  tag: string
  attrs: Record<string, string>
  children: XmlChild[]
}

export type XmlChild = XmlNode | { text: string }

export class XmlError extends Error {}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

export function escapeXmlText(value: string): string {
  return value.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'))
}

export function escapeXmlAttr(value: string): string {
  return value.replace(/[&<>"]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&quot;'))
}

export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X'
      const code = parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole
  })
}

function isNameChar(c: string): boolean {
  return /[^\s=/>]/.test(c)
}

/** Parse an XML document into a single root node. */
export function parseXml(source: string): XmlNode {
  let i = 0
  const text = source

  function skipMisc(): void {
    for (;;) {
      while (i < text.length && /\s/.test(text[i])) i++
      if (text.startsWith('<?', i)) {
        const end = text.indexOf('?>', i)
        if (end < 0) throw new XmlError('Unterminated processing instruction.')
        i = end + 2
      } else if (text.startsWith('<!--', i)) {
        const end = text.indexOf('-->', i)
        if (end < 0) throw new XmlError('Unterminated comment.')
        i = end + 3
      } else if (text.startsWith('<!DOCTYPE', i) || text.startsWith('<!doctype', i)) {
        const end = text.indexOf('>', i)
        if (end < 0) throw new XmlError('Unterminated DOCTYPE.')
        i = end + 1
      } else {
        return
      }
    }
  }

  function readName(): string {
    const start = i
    while (i < text.length && isNameChar(text[i])) i++
    if (i === start) throw new XmlError('Expected a tag name.')
    return text.slice(start, i)
  }

  function readElement(): XmlNode {
    if (text[i] !== '<') throw new XmlError('Expected an element.')
    i++
    const tag = readName()
    const attrs: Record<string, string> = {}
    for (;;) {
      while (i < text.length && /\s/.test(text[i])) i++
      if (text[i] === '/' && text[i + 1] === '>') {
        i += 2
        return { tag, attrs, children: [] }
      }
      if (text[i] === '>') {
        i++
        break
      }
      if (i >= text.length) throw new XmlError(`Unterminated <${tag}>.`)
      const name = readName()
      while (i < text.length && /\s/.test(text[i])) i++
      if (text[i] !== '=') throw new XmlError(`Attribute ${name} is missing a value.`)
      i++
      while (i < text.length && /\s/.test(text[i])) i++
      const quote = text[i]
      if (quote !== '"' && quote !== "'") throw new XmlError(`Attribute ${name} must be quoted.`)
      const end = text.indexOf(quote, i + 1)
      if (end < 0) throw new XmlError(`Unterminated value for ${name}.`)
      attrs[name] = decodeEntities(text.slice(i + 1, end))
      i = end + 1
    }

    const children: XmlChild[] = []
    for (;;) {
      if (i >= text.length) throw new XmlError(`Missing closing tag for <${tag}>.`)
      if (text.startsWith('</', i)) {
        i += 2
        const closing = readName()
        if (closing !== tag) throw new XmlError(`Expected </${tag}> but found </${closing}>.`)
        while (i < text.length && /\s/.test(text[i])) i++
        if (text[i] !== '>') throw new XmlError(`Malformed closing tag for <${tag}>.`)
        i++
        return { tag, attrs, children }
      }
      if (text.startsWith('<!--', i)) {
        const end = text.indexOf('-->', i)
        if (end < 0) throw new XmlError('Unterminated comment.')
        i = end + 3
        continue
      }
      if (text.startsWith('<![CDATA[', i)) {
        const end = text.indexOf(']]>', i)
        if (end < 0) throw new XmlError('Unterminated CDATA section.')
        children.push({ text: text.slice(i + 9, end) })
        i = end + 3
        continue
      }
      if (text[i] === '<') {
        children.push(readElement())
        continue
      }
      const next = text.indexOf('<', i)
      const chunk = next < 0 ? text.slice(i) : text.slice(i, next)
      i = next < 0 ? text.length : next
      if (chunk.trim()) children.push({ text: decodeEntities(chunk) })
    }
  }

  skipMisc()
  const root = readElement()
  skipMisc()
  if (i < text.length) throw new XmlError('Unexpected content after the root element.')
  return root
}

/** Convert an XML tree into plain JSON. Attributes and text get `@`-prefixed keys. */
export function xmlToJson(node: XmlNode): unknown {
  const attrKeys = Object.keys(node.attrs)
  const elementChildren = node.children.filter((child): child is XmlNode => 'tag' in child)
  const textChildren = node.children.filter((child): child is { text: string } => 'text' in child)
  const text = textChildren.map((child) => child.text).join('').trim()

  if (attrKeys.length === 0 && elementChildren.length === 0) {
    return text
  }

  const out: Record<string, unknown> = {}
  for (const key of attrKeys) out[`@${key}`] = node.attrs[key]

  const grouped = new Map<string, XmlNode[]>()
  for (const child of elementChildren) {
    const bucket = grouped.get(child.tag) ?? []
    bucket.push(child)
    grouped.set(child.tag, bucket)
  }
  for (const [tag, nodes] of grouped) {
    out[tag] = nodes.length === 1 ? xmlToJson(nodes[0]) : nodes.map(xmlToJson)
  }
  // Text with attributes but no children still needs to survive.
  if (text && elementChildren.length === 0) out['#text'] = text
  return out
}

/** Build XML from JSON. Values become elements; `@name` keys become attributes. */
export function jsonToXml(value: unknown): string {
  const build = (name: string, node: unknown, level: number): string => {
    const pad = '  '.repeat(level)
    if (node === null || node === undefined) return `${pad}<${name}/>`
    if (typeof node !== 'object') return `${pad}<${name}>${escapeXmlText(String(node))}</${name}>`
    if (Array.isArray(node)) {
      return node.map((item) => build(name, item, level)).join('\n')
    }

    const record = node as Record<string, unknown>
    const attrs: string[] = []
    const body: string[] = []
    for (const [key, item] of Object.entries(record)) {
      if (key.startsWith('@')) attrs.push(`${key.slice(1)}="${escapeXmlAttr(String(item))}"`)
      else if (key === '#text') body.push(escapeXmlText(String(item)))
      else body.push(build(key, item, level + 1))
    }
    const attrText = attrs.length ? ` ${attrs.join(' ')}` : ''
    if (body.length === 0) return `${pad}<${name}${attrText}/>`
    if (body.length === 1 && !body[0].includes('\n')) return `${pad}<${name}${attrText}>${body[0].trim()}</${name}>`
    return `${pad}<${name}${attrText}>\n${body.join('\n')}\n${pad}</${name}>`
  }

  const root = (value && typeof value === 'object' && !Array.isArray(value) ? value : { root: value }) as Record<string, unknown>
  const keys = Object.keys(root)
  if (keys.length === 1 && !keys[0].startsWith('@')) {
    return build(keys[0], root[keys[0]], 0)
  }
  return build('root', root, 0)
}
