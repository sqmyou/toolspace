import { describe, expect, it } from 'vitest'
import { yourLogic } from './tool'

describe('yourLogic', () => {
  it('trims whitespace', () => {
    expect(yourLogic('  hello  ')).toBe('hello')
  })
})
