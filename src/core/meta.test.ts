import { beforeEach, describe, expect, it } from 'vitest'
import { SITE_ORIGIN, applyMeta, canonicalUrl, pageTitle } from './meta'

/**
 * The vitest environment is plain node — no DOM, and the project takes no
 * runtime dependencies, so rather than add jsdom we stub only the document
 * APIs `applyMeta` touches. That keeps the test honest about the exact
 * surface the module needs.
 */
class FakeElement {
  attrs: Record<string, string> = {}
  href = ''
  rel = ''
  content = ''
  setAttribute(key: string, value: string) {
    this.attrs[key] = value
  }
  getAttribute(key: string) {
    if (key in this.attrs) return this.attrs[key]
    if (key === 'href') return this.href
    return null
  }
}

let tags: FakeElement[]

function fakeDocument() {
  tags = []
  const head = {
    querySelector(selector: string): FakeElement | null {
      const match = /^(meta|link)\[([a-z]+)="([^"]+)"\]$/.exec(selector)
      if (!match) return null
      const [, tag, key, value] = match
      return (
        tags.find(
          (t) => t.attrs.__tag === tag && (key === 'href' ? t.href : t.attrs[key]) === value,
        ) ?? null
      )
    },
    append(node: FakeElement) {
      tags.push(node)
    },
  }
  return {
    head,
    title: '',
    createElement(tag: string) {
      const node = new FakeElement()
      node.attrs.__tag = tag
      return node
    },
  }
}

describe('pageTitle', () => {
  it('suffixes a tool name with the brand', () => {
    expect(pageTitle('JWT Decoder')).toBe('JWT Decoder — toolspace')
  })

  it('falls back to the site title', () => {
    expect(pageTitle()).toContain('toolspace')
    expect(pageTitle()).toContain('run in your browser')
  })
})

describe('canonicalUrl', () => {
  it('maps the home route to the bare origin', () => {
    expect(canonicalUrl('/')).toBe(`${SITE_ORIGIN}/`)
  })

  it('prefixes a hash for every other route', () => {
    expect(canonicalUrl('/json-diff')).toBe(`${SITE_ORIGIN}/#/json-diff`)
  })
})

describe('applyMeta', () => {
  beforeEach(() => {
    ;(globalThis as { document?: unknown }).document = fakeDocument()
  })

  it('sets the document title with the brand suffix', () => {
    applyMeta({ title: 'JSON Diff', path: '/json-diff' })
    expect((globalThis as { document: { title: string } }).document.title).toBe('JSON Diff — toolspace')
  })

  it('writes the description to name and both social properties', () => {
    applyMeta({ title: 'JSON Diff', description: 'Compare two JSON documents.', path: '/json-diff' })
    const found = tags.filter((t) => t.content === 'Compare two JSON documents.')
    expect(found).toHaveLength(3)
    expect(found.map((t) => t.attrs.name ?? t.attrs.property).sort()).toEqual([
      'description',
      'og:description',
      'twitter:description',
    ])
  })

  it('updates the existing tag rather than adding a second one', () => {
    applyMeta({ title: 'One', path: '/one' })
    applyMeta({ title: 'Two', path: '/two' })
    expect(tags.filter((t) => t.attrs.property === 'og:title')).toHaveLength(1)
    expect(tags.find((t) => t.attrs.property === 'og:title')?.content).toBe('Two — toolspace')
  })

  it('restores the site description when a route has none', () => {
    applyMeta({ title: 'JSON Diff', description: 'Specific.', path: '/json-diff' })
    applyMeta({ path: '/' })
    const desc = tags.find((t) => t.attrs.name === 'description')?.content ?? ''
    expect(desc).toContain('no server to send it to')
    expect(desc).not.toBe('Specific.')
  })
})
