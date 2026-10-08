/**
 * A focused JSONPath evaluator.
 *
 * Supported syntax:
 *   $                root
 *   .name  ['name']  child (dot or bracket form)
 *   .*     [*]       every child of an object or array
 *   ..name ..*       recursive descent
 *   [0]  [-1]        array index, negative counts from the end
 *   [0:3] [start:end:step]  array slice
 *   [?(expr)]        filter, e.g. [?(@.price > 10)] or [?(@.tag == "x")]
 *
 * Filters accept a small comparison grammar only — no arbitrary JavaScript —
 * so a path can never execute code from the input document.
 */

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export interface JsonPathMatch {
  path: string
  value: JsonValue
}

export class JsonPathError extends Error {}

interface Segment {
  kind: 'child' | 'wildcard' | 'recursive' | 'index' | 'slice' | 'filter'
  name?: string
  index?: number
  slice?: { start?: number; end?: number; step: number }
  filter?: (value: JsonValue) => boolean
}

const IDENT = /^[A-Za-z_$][\w$-]*/

function parsePath(path: string): Segment[] {
  const text = path.trim()
  if (!text.startsWith('$')) throw new JsonPathError('A path must start with "$"')
  const segments: Segment[] = []
  let i = 1

  while (i < text.length) {
    if (text.startsWith('..', i)) {
      i += 2
      const match = IDENT.exec(text.slice(i))
      if (match) {
        segments.push({ kind: 'recursive', name: match[0] })
        i += match[0].length
      } else if (text[i] === '*') {
        segments.push({ kind: 'recursive' })
        i += 1
      } else if (text[i] === '[') {
        segments.push({ kind: 'recursive' })
      } else {
        throw new JsonPathError('Expected a name or "*" after ".."')
      }
      continue
    }

    if (text[i] === '.') {
      i += 1
      if (text[i] === '*') {
        segments.push({ kind: 'wildcard' })
        i += 1
        continue
      }
      const match = IDENT.exec(text.slice(i))
      if (!match) throw new JsonPathError(`Expected a property name at position ${i}`)
      segments.push({ kind: 'child', name: match[0] })
      i += match[0].length
      continue
    }

    if (text[i] === '[') {
      const end = findBracketEnd(text, i)
      const inner = text.slice(i + 1, end).trim()
      segments.push(parseBracket(inner))
      i = end + 1
      continue
    }

    throw new JsonPathError(`Unexpected character "${text[i]}" at position ${i}`)
  }

  return segments
}

function findBracketEnd(text: string, start: number): number {
  let depth = 0
  let quote: string | null = null
  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (char === '\\') i += 1
      else if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") quote = char
    else if (char === '[') depth += 1
    else if (char === ']') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  throw new JsonPathError('Unclosed "[" in path')
}

function parseBracket(inner: string): Segment {
  if (inner === '*') return { kind: 'wildcard' }

  if (inner.startsWith('?')) {
    const body = inner.replace(/^\?\s*/, '')
    const wrapped = /^\(\s*(.*)\s*\)$/.exec(body)
    return { kind: 'filter', filter: compileFilter(wrapped ? wrapped[1] : body) }
  }

  if (/^-?\d+$/.test(inner)) return { kind: 'index', index: Number(inner) }

  if (inner.includes(':')) {
    const [startText, endText, stepText] = inner.split(':')
    const start = startText.trim() === '' ? undefined : Number(startText)
    const end = endText === undefined || endText.trim() === '' ? undefined : Number(endText)
    const step = stepText === undefined || stepText.trim() === '' ? 1 : Number(stepText)
    if (step === 0 || Number.isNaN(step)) throw new JsonPathError('A slice step cannot be zero')
    if ((start !== undefined && Number.isNaN(start)) || (end !== undefined && Number.isNaN(end))) throw new JsonPathError('Slice bounds must be numbers')
    return { kind: 'slice', slice: { start, end, step } }
  }

  const quoted = /^(['"])(.*)\1$/.exec(inner)
  if (quoted) return { kind: 'child', name: quoted[2] }

  throw new JsonPathError(`Cannot parse "[${inner}]"`)
}

const COMPARISON = /^\s*@\.([\w.$-]+)\s*(==|!=|<=|>=|<|>|=~)\s*(.+?)\s*$/

function literal(text: string): JsonValue {
  const trimmed = text.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  const quoted = /^(['"])([\s\S]*)\1$/.exec(trimmed)
  if (quoted) return quoted[2]
  throw new JsonPathError(`Cannot read the value "${trimmed}" in a filter`)
}

function readPath(value: JsonValue, path: string): JsonValue {
  let node: JsonValue = value
  for (const part of path.split('.')) {
    if (node && typeof node === 'object' && !Array.isArray(node) && part in node) node = (node as Record<string, JsonValue>)[part]
    else return undefined as unknown as JsonValue
  }
  return node
}

function compileFilter(expression: string): (value: JsonValue) => boolean {
  const exists = /^@\.([\w.$-]+)$/.exec(expression.trim())
  if (exists) return (value) => readPath(value, exists[1]) !== undefined

  const match = COMPARISON.exec(expression)
  if (!match) throw new JsonPathError(`Cannot parse the filter "${expression}"`)

  const [, path, operator, rawRight] = match
  const right = literal(rawRight)

  return (value) => {
    const left = readPath(value, path)
    if (left === undefined) return false
    switch (operator) {
      case '==':
      case '=':
        return left === right
      case '!=':
        return left !== right
      case '<':
        return typeof left === 'number' && typeof right === 'number' && left < right
      case '<=':
        return typeof left === 'number' && typeof right === 'number' && left <= right
      case '>':
        return typeof left === 'number' && typeof right === 'number' && left > right
      case '>=':
        return typeof left === 'number' && typeof right === 'number' && left >= right
      case '=~':
        return typeof left === 'string' && typeof right === 'string' && new RegExp(right).test(left)
      default:
        return false
    }
  }
}

function isObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function join(prefix: string, key: string | number): string {
  return typeof key === 'number' ? `${prefix}[${key}]` : `${prefix}.${key}`
}

function descend(value: JsonValue, name: string | undefined, prefix: string, out: JsonPathMatch[]): void {
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (name === undefined || key === name) out.push({ path: join(prefix, key), value: child })
      descend(child, name, join(prefix, key), out)
    }
  } else if (Array.isArray(value)) {
    value.forEach((child, index) => {
      if (name === undefined) out.push({ path: join(prefix, index), value: child })
      descend(child, name, join(prefix, index), out)
    })
  }
}

function applySegment(nodes: JsonPathMatch[], segment: Segment): JsonPathMatch[] {
  const out: JsonPathMatch[] = []
  for (const node of nodes) {
    const value = node.value
    switch (segment.kind) {
      case 'child':
        if (isObject(value) && segment.name! in value) out.push({ path: join(node.path, segment.name!), value: value[segment.name!] })
        break
      case 'wildcard':
        if (isObject(value)) for (const [key, child] of Object.entries(value)) out.push({ path: join(node.path, key), value: child })
        else if (Array.isArray(value)) value.forEach((child, index) => out.push({ path: join(node.path, index), value: child }))
        break
      case 'recursive':
        descend(value, segment.name, node.path, out)
        break
      case 'index': {
        if (!Array.isArray(value)) break
        const index = segment.index! < 0 ? value.length + segment.index! : segment.index!
        if (index >= 0 && index < value.length) out.push({ path: join(node.path, index), value: value[index] })
        break
      }
      case 'slice': {
        if (!Array.isArray(value)) break
        const { start, end, step } = segment.slice!
        const length = value.length
        const from = start === undefined ? (step > 0 ? 0 : length - 1) : start < 0 ? length + start : start
        const to = end === undefined ? (step > 0 ? length : -1) : end < 0 ? length + end : end
        if (step > 0) {
          for (let i = Math.max(0, from); i < Math.min(length, to); i += step) out.push({ path: join(node.path, i), value: value[i] })
        } else {
          for (let i = Math.min(length - 1, from); i > Math.max(-1, to); i += step) out.push({ path: join(node.path, i), value: value[i] })
        }
        break
      }
      case 'filter':
        if (Array.isArray(value)) value.forEach((child, index) => { if (segment.filter!(child)) out.push({ path: join(node.path, index), value: child }) })
        else if (isObject(value)) for (const [key, child] of Object.entries(value)) if (segment.filter!(child)) out.push({ path: join(node.path, key), value: child })
        break
    }
  }
  return out
}

/** Evaluate a JSONPath against a document, returning every match. */
export function query(document: JsonValue, path: string): JsonPathMatch[] {
  const segments = parsePath(path)
  let nodes: JsonPathMatch[] = [{ path: '$', value: document }]
  for (const segment of segments) nodes = applySegment(nodes, segment)
  return nodes
}
