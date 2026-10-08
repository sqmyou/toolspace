/**
 * A small mustache-style template engine.
 *
 * Supports {{name}}, nested paths like {{user.name}}, {{{raw}}} for
 * unescaped output, {{#key}}…{{/key}} sections, {{^key}} inverted sections
 * and {{! comments }}. Deliberately no expressions or function calls, so a
 * template can never run code.
 */

export interface TemplateContext {
  [key: string]: unknown
}

export class TemplateError extends Error {}

const TOKEN = /\{\{\{?\s*([#^/!]?)\s*([\w.$-]*)\s*\}?\}\}/g

function lookup(path: string, stack: TemplateContext[]): unknown {
  if (!path) return undefined
  for (let i = stack.length - 1; i >= 0; i--) {
    const parts = path.split('.')
    let value: unknown = stack[i]
    let found = true
    for (const part of parts) {
      if (value && typeof value === 'object' && part in (value as TemplateContext)) {
        value = (value as TemplateContext)[part]
      } else {
        found = false
        break
      }
    }
    if (found) return value
  }
  return undefined
}

function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function stringify(value: unknown, escape: boolean): string {
  if (value == null) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return escape ? escapeText(text) : text
}

function truthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  return Boolean(value)
}

interface Token {
  kind: 'text' | 'var' | 'raw' | 'section' | 'inverted'
  value: string
}

const COMMENT = /\{\{![\s\S]*?\}\}/g

function tokenize(source: string): Token[] {
  // Comments may contain spaces, so strip them before tokenising.
  const text = source.replace(COMMENT, '')
  const tokens: Token[] = []
  let last = 0
  TOKEN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TOKEN.exec(text))) {
    if (match.index > last) tokens.push({ kind: 'text', value: text.slice(last, match.index) })
    const [full, marker, name] = match
    if (marker === '#') tokens.push({ kind: 'section', value: name })
    else if (marker === '^') tokens.push({ kind: 'inverted', value: name })
    else if (marker === '/') tokens.push({ kind: 'text', value: `\u0000/${name}\u0000` })
    else tokens.push({ kind: full.startsWith('{{{') ? 'raw' : 'var', value: name })
    last = match.index + full.length
  }
  if (last < text.length) tokens.push({ kind: 'text', value: text.slice(last) })
  return tokens
}

function renderTokens(tokens: Token[], stack: TemplateContext[], start: number, end: string): { html: string; index: number } {
  let out = ''
  let index = start
  while (index < tokens.length) {
    const token = tokens[index]
    if (token.kind === 'text') {
      const close = /^\u0000\/(.*)\u0000$/.exec(token.value)
      if (close) {
        if (close[1] === end) return { html: out, index }
        throw new TemplateError(`Unexpected closing tag {{/${close[1]}}}`)
      }
      out += token.value
      index += 1
    } else if (token.kind === 'var') {
      out += stringify(lookup(token.value, stack), true)
      index += 1
    } else if (token.kind === 'raw') {
      out += stringify(lookup(token.value, stack), false)
      index += 1
    } else {
      const value = lookup(token.value, stack)
      const isSection = token.kind === 'section'
      if (isSection && !truthy(value)) {
        // Skip to the matching close tag.
        const skipped = renderTokens(tokens, stack, index + 1, token.value)
        index = skipped.index + 1
      } else if (!isSection && truthy(value)) {
        const skipped = renderTokens(tokens, stack, index + 1, token.value)
        index = skipped.index + 1
      } else if (Array.isArray(value)) {
        // Each iteration renders the same body; only the scope changes.
        const bodyStart = index + 1
        let cursor = bodyStart
        for (const item of value) {
          const inner = renderTokens(tokens, [...stack, item as TemplateContext], bodyStart, token.value)
          out += inner.html
          cursor = inner.index
        }
        index = cursor + 1
      } else {
        const inner = renderTokens(tokens, [...stack, value as TemplateContext], index + 1, token.value)
        out += inner.html
        index = inner.index + 1
      }
    }
  }
  if (end) throw new TemplateError(`Missing closing tag {{/${end}}}`)
  return { html: out, index }
}

/** Render a template against a context object. */
export function render(template: string, context: TemplateContext): string {
  return renderTokens(tokenize(template), [context], 0, '').html
}

/** Names referenced by the template, in order of first appearance. */
export function placeholders(template: string): string[] {
  const names: string[] = []
  TOKEN.lastIndex = 0
  let match: RegExpExecArray | null
  const text = template.replace(COMMENT, '')
  while ((match = TOKEN.exec(text))) {
    const marker = match[1]
    const name = match[2]
    if (name && marker !== '/' && marker !== '!' && !names.includes(name)) names.push(name)
  }
  return names
}

/** Build a context from "key=value" lines. */
export function contextFromPairs(text: string): TemplateContext {
  const context: TemplateContext = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    const parts = key.split('.')
    let node = context
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof node[parts[i]] !== 'object' || node[parts[i]] == null) node[parts[i]] = {}
      node = node[parts[i]] as TemplateContext
    }
    node[parts[parts.length - 1]] = value
  }
  return context
}

export { lookup as templateLookup }
