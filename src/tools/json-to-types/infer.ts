/**
 * Infer TypeScript types from a JSON sample.
 *
 * The hard part is arrays: a field that is sometimes missing and sometimes
 * present should be optional, and an array of differing objects should become
 * one interface with unioned fields. Shapes are merged first, then names are
 * assigned once the merged tree is stable.
 */

type Primitive = 'string' | 'number' | 'boolean' | 'null' | 'unknown'

type TypeNode =
  | { kind: 'primitive'; name: Primitive }
  | { kind: 'array'; element: TypeNode }
  | { kind: 'object'; fields: Field[]; name?: string }
  | { kind: 'union'; options: TypeNode[] }

interface Field {
  name: string
  type: TypeNode
  optional: boolean
}

export interface InferOptions {
  rootName?: string
}

export class JsonTypeError extends Error {}

/** Build a type tree from a parsed JSON value. */
export function infer(value: unknown): TypeNode {
  if (value === null) return { kind: 'primitive', name: 'null' }
  if (Array.isArray(value)) {
    if (value.length === 0) return { kind: 'array', element: { kind: 'primitive', name: 'unknown' } }
    return { kind: 'array', element: value.map(infer).reduce(merge) }
  }
  if (typeof value === 'object') {
    const fields: Field[] = Object.entries(value as Record<string, unknown>).map(([name, v]) => ({
      name,
      type: infer(v),
      optional: false,
    }))
    return { kind: 'object', fields }
  }
  if (typeof value === 'string') return { kind: 'primitive', name: 'string' }
  if (typeof value === 'number') return { kind: 'primitive', name: 'number' }
  if (typeof value === 'boolean') return { kind: 'primitive', name: 'boolean' }
  return { kind: 'primitive', name: 'unknown' }
}

/** Combine two type trees, widening as needed. */
export function merge(a: TypeNode, b: TypeNode): TypeNode {
  if (a.kind === 'primitive' && b.kind === 'primitive') {
    return a.name === b.name ? a : { kind: 'union', options: dedupe([a, b]) }
  }
  if (a.kind === 'array' && b.kind === 'array') {
    return { kind: 'array', element: merge(a.element, b.element) }
  }
  if (a.kind === 'object' && b.kind === 'object') {
    const names = new Set([...a.fields.map((f) => f.name), ...b.fields.map((f) => f.name)])
    const fields: Field[] = []
    for (const name of names) {
      const left = a.fields.find((f) => f.name === name)
      const right = b.fields.find((f) => f.name === name)
      if (left && right) {
        fields.push({ name, type: merge(left.type, right.type), optional: left.optional && right.optional })
      } else {
        fields.push({ name, type: (left ?? right)!.type, optional: true })
      }
    }
    return { kind: 'object', fields }
  }
  const options = [...(a.kind === 'union' ? a.options : [a]), ...(b.kind === 'union' ? b.options : [b])]
  return { kind: 'union', options: dedupeTypes(options) }
}

function dedupe<T>(items: T[]): T[] {
  return items.filter((item, index) => items.indexOf(item) === index)
}

function dedupeTypes(nodes: TypeNode[]): TypeNode[] {
  const seen = new Set<string>()
  const out: TypeNode[] = []
  for (const node of nodes) {
    const key = renderInline(node)
    if (!seen.has(key)) {
      seen.add(key)
      out.push(node)
    }
  }
  return out
}

function pascal(text: string): string {
  const cleaned = text.replace(/[^a-zA-Z0-9]+/g, ' ').trim()
  if (!cleaned) return 'Type'
  const joined = cleaned
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
  return /^\d/.test(joined) ? `Type${joined}` : joined
}

/** "users" -> "User", "statuses" -> "Status", "data" -> "Data". */
function singular(text: string): string {
  if (/ies$/i.test(text)) return text.replace(/ies$/i, 'y')
  if (/(ses|xes|zes|ches|shes)$/i.test(text)) return text.replace(/es$/i, '')
  if (/s$/i.test(text) && !/ss$/i.test(text)) return text.replace(/s$/i, '')
  return text
}

export interface InferResult {
  /** The generated TypeScript source. */
  code: string
  /** The type name given to the root value. */
  rootType: string
}

/** Infer types and render them as TypeScript interfaces. */
export function inferTypes(json: string, options: InferOptions = {}): InferResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (error) {
    throw new JsonTypeError(error instanceof Error ? error.message : 'Invalid JSON.')
  }

  const rootName = pascal(options.rootName ?? 'Root')
  const tree = infer(parsed)

  const interfaces: { name: string; fields: Field[] }[] = []
  const used = new Set<string>()

  // Assign a unique interface name for an object, avoiding collisions.
  function nameObject(node: Extract<TypeNode, { kind: 'object' }>, preferred: string): string {
    let name = pascal(preferred)
    if (used.has(name)) {
      const existing = interfaces.find((i) => i.name === name)
      if (existing && sameShape(existing.fields, node.fields)) return name
      let counter = 2
      while (used.has(`${name}${counter}`)) counter++
      name = `${name}${counter}`
    }
    used.add(name)
    node.name = name

    // Record before recursing so self-references resolve by name.
    interfaces.push({ name, fields: node.fields })
    for (const field of node.fields) {
      assignNames(field.type, pascal(singular(field.name)), field.name)
    }
    return name
  }

  function assignNames(node: TypeNode, preferred: string, fieldName: string) {
    if (node.kind === 'object') {
      nameObject(node, preferred)
    } else if (node.kind === 'array') {
      assignNames(node.element, preferred, fieldName)
    } else if (node.kind === 'union') {
      for (const option of node.options) assignNames(option, preferred, fieldName)
    }
  }

  let rootType: string
  if (tree.kind === 'object') {
    rootType = nameObject(tree, rootName)
  } else {
    // Root is an array or primitive: name any objects it contains, then emit
    // a type alias for the root itself.
    if (tree.kind === 'array') assignNames(tree.element, `${rootName}Item`, rootName)
    rootType = rootName
  }

  const blocks = interfaces.map((iface) => renderInterface(iface))
  if (tree.kind !== 'object') {
    blocks.unshift(`export type ${rootName} = ${renderInline(tree)}`)
  }

  return { code: blocks.join('\n\n') + '\n', rootType }
}

function sameShape(a: Field[], b: Field[]): boolean {
  if (a.length !== b.length) return false
  return a.every((field, index) => field.name === b[index].name && renderInline(field.type) === renderInline(b[index].type))
}

function renderInterface(iface: { name: string; fields: Field[] }): string {
  if (iface.fields.length === 0) return `export interface ${iface.name} {}`
  const lines = iface.fields.map((field) => {
    const key = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(field.name) ? field.name : JSON.stringify(field.name)
    return `  ${key}${field.optional ? '?' : ''}: ${renderInline(field.type)};`
  })
  return `export interface ${iface.name} {\n${lines.join('\n')}\n}`
}

/** Render a type reference inline, using named interfaces where available. */
function renderInline(node: TypeNode): string {
  switch (node.kind) {
    case 'primitive':
      return node.name
    case 'array':
      return `${needsParens(node.element) ? `(${renderInline(node.element)})` : renderInline(node.element)}[]`
    case 'union':
      return node.options.map((option) => renderInline(option)).join(' | ')
    case 'object':
      return node.name ?? 'unknown'
  }
}

function needsParens(node: TypeNode): boolean {
  return node.kind === 'union'
}
