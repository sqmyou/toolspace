import { describe, expect, it } from 'vitest'
import { inferTypes, JsonTypeError } from './infer'

function run(json: string) {
  return inferTypes(json).code
}

describe('inferTypes', () => {
  it('throws on invalid JSON', () => {
    expect(() => inferTypes('{ not json')).toThrow(JsonTypeError)
  })

  it('infers primitives', () => {
    const code = run('{"name":"Ada","age":36,"active":true,"nickname":null}')
    expect(code).toContain('name: string;')
    expect(code).toContain('age: number;')
    expect(code).toContain('active: boolean;')
    expect(code).toContain('nickname: null;')
  })

  it('names the root interface Root by default', () => {
    expect(run('{"a":1}')).toContain('export interface Root {')
  })

  it('uses a custom root name', () => {
    expect(inferTypes('{"a":1}', { rootName: 'User' }).code).toContain('export interface User {')
  })

  it('quotes keys that are not valid identifiers', () => {
    expect(run('{"first-name":"Ada"}')).toContain('"first-name": string;')
  })

  it('creates nested interfaces named after the field', () => {
    const code = run('{"user":{"id":1,"name":"Ada"}}')
    expect(code).toContain('export interface User {')
    expect(code).toContain('user: User;')
  })

  it('singularises array element names', () => {
    const code = run('{"users":[{"id":1}]}')
    expect(code).toContain('users: User[];')
  })

  it('turns ies plurals into y for the type name', () => {
    const code = run('{"companies":[{"id":1}]}')
    expect(code).toContain('companies: Company[];')
    expect(code).toContain('export interface Company {')
  })

  it('merges object arrays into one interface with optional fields', () => {
    const code = run('{"items":[{"a":1},{"b":2}]}')
    expect(code).toContain('a?: number;')
    expect(code).toContain('b?: number;')
  })

  it('unions differing primitive array elements', () => {
    const code = run('{"tags":["x",1]}')
    expect(code).toContain('tags: (string | number)[];')
  })

  it('marks a field missing from one array item as optional', () => {
    const code = run('{"rows":[{"id":1,"note":"x"},{"id":2}]}')
    expect(code).toContain('id: number;')
    expect(code).toContain('note?: string;')
  })

  it('emits a type alias when the root is an array', () => {
    const code = run('[{"id":1},{"id":2}]')
    expect(code).toContain('export type Root = RootItem[]')
    expect(code).toContain('export interface RootItem {')
  })

  it('handles an empty array as unknown[]', () => {
    expect(run('{"list":[]}')).toContain('list: unknown[];')
  })

  it('handles an empty object', () => {
    expect(run('{}')).toContain('export interface Root {}')
  })

  it('handles deeply nested structures', () => {
    const code = run('{"a":{"b":{"c":{"d":1}}}}')
    expect(code).toContain('d: number;')
    expect(code).toContain('c: C;')
    expect(code).toContain('b: B;')
    expect(code).toContain('a: A;')
  })

  it('produces deterministic output', () => {
    const json = '{"z":1,"a":{"x":true}}'
    expect(run(json)).toBe(run(json))
  })
})
