import { describe, expect, it } from 'vitest'
import {
  camelCase, constantCase, dotCase, kebabCase, lower, pascalCase, reverse,
  sentenceCase, snakeCase, titleCase, toggleCase, transformLines, upper, words,
} from './case'

describe('words', () => {
  it('splits camel, snake, kebab and spaces', () => {
    expect(words('fooBarBaz')).toEqual(['foo', 'bar', 'baz'])
    expect(words('foo_bar-baz')).toEqual(['foo', 'bar', 'baz'])
    expect(words('HTTPServer')).toEqual(['http', 'server'])
    expect(words('version2Beta')).toEqual(['version', '2', 'beta'])
  })
})

describe('case conversions', () => {
  it('converts basic cases', () => {
    expect(upper('Abc')).toBe('ABC')
    expect(lower('AbC')).toBe('abc')
    expect(sentenceCase('hello WORLD')).toBe('Hello world')
    expect(titleCase('the lord of the rings')).toBe('The Lord of the Rings')
  })

  it('converts identifier cases', () => {
    expect(camelCase('hello world')).toBe('helloWorld')
    expect(pascalCase('hello world')).toBe('HelloWorld')
    expect(snakeCase('helloWorld')).toBe('hello_world')
    expect(kebabCase('hello_world')).toBe('hello-world')
    expect(constantCase('hello world')).toBe('HELLO_WORLD')
    expect(dotCase('hello world')).toBe('hello.world')
  })

  it('toggles and reverses', () => {
    expect(toggleCase('AbC')).toBe('aBc')
    expect(reverse('abc')).toBe('cba')
    expect(reverse('a😀b')).toBe('b😀a')
  })
})

describe('transformLines', () => {
  it('trims, sorts, dedupes and reverses', () => {
    const input = '  b \n a \n b\n\n'
    expect(transformLines(input, { trim: true, sort: true, dedupe: true, reverse: false })).toBe('a\nb')
    expect(transformLines('a\nb', { trim: false, sort: false, dedupe: false, reverse: true })).toBe('b\na')
  })
})
