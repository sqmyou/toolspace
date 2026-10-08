import { describe, expect, it } from 'vitest'
import { contextFromPairs, placeholders, render, TemplateError } from './template'

describe('render', () => {
  it('substitutes simple variables and escapes HTML', () => {
    expect(render('Hi {{name}}', { name: 'Sam' })).toBe('Hi Sam')
    expect(render('{{x}}', { x: '<b>' })).toBe('&lt;b&gt;')
    expect(render('{{{x}}}', { x: '<b>' })).toBe('<b>')
  })

  it('resolves nested paths', () => {
    expect(render('{{user.name}}', { user: { name: 'Ada' } })).toBe('Ada')
  })

  it('renders missing values as empty', () => {
    expect(render('[{{missing}}]', {})).toBe('[]')
  })

  it('iterates arrays in sections', () => {
    expect(render('{{#items}}{{name}} {{/items}}', { items: [{ name: 'a' }, { name: 'b' }] })).toBe('a b ')
  })

  it('treats an object as a section scope', () => {
    expect(render('{{#user}}{{name}}{{/user}}', { user: { name: 'Ada' } })).toBe('Ada')
  })

  it('skips falsey sections and renders inverted ones', () => {
    expect(render('a{{#x}}b{{/x}}c', { x: false })).toBe('ac')
    expect(render('{{^x}}none{{/x}}', {})).toBe('none')
    expect(render('{{^x}}none{{/x}}', { x: true })).toBe('')
  })

  it('strips comments', () => {
    expect(render('a{{! ignore me }}b', {})).toBe('ab')
  })

  it('serialises objects as JSON, escaping when asked', () => {
    expect(render('{{o}}', { o: { a: 1 } })).toBe('{"a":1}')
    expect(render('{{o}}', { o: { a: '<' } })).toBe('{"a":"&lt;"}')
    expect(render('{{{o}}}', { o: { a: '<' } })).toBe('{"a":"<"}')
  })

  it('throws on unbalanced tags', () => {
    expect(() => render('{{#a}}x', { a: true })).toThrow(TemplateError)
    expect(() => render('{{/a}}', {})).toThrow(TemplateError)
  })

  it('renders a realistic template', () => {
    const output = render('Hello {{name}},\n{{#orders}}- {{id}}: {{total}}\n{{/orders}}', {
      name: 'Sam',
      orders: [{ id: 1, total: 10 }, { id: 2, total: 20 }],
    })
    expect(output).toBe('Hello Sam,\n- 1: 10\n- 2: 20\n')
  })
})

describe('placeholders', () => {
  it('lists unique names in order', () => {
    expect(placeholders('{{b}} {{a}} {{b}} {{{c}}}')).toEqual(['b', 'a', 'c'])
  })

  it('ignores comments and closers', () => {
    expect(placeholders('{{#x}}{{! hi }}{{/x}}')).toEqual(['x'])
  })
})

describe('contextFromPairs', () => {
  it('builds a nested object from key=value lines', () => {
    expect(contextFromPairs('name=Sam\nuser.city=London')).toEqual({ name: 'Sam', user: { city: 'London' } })
  })

  it('skips blanks and comments', () => {
    expect(contextFromPairs('# note\n\nkey=value')).toEqual({ key: 'value' })
  })
})
