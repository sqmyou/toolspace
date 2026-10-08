import { describe, expect, it } from 'vitest'
import { ChmodError, digitToPermission, emptyPermissions, explain, fromOctal, fromSymbolic, permissionDigit, toOctal, toSymbolic } from './chmod'

describe('digit conversion', () => {
  it('maps a digit to flags', () => {
    expect(digitToPermission(7)).toEqual({ read: true, write: true, execute: true })
    expect(digitToPermission(5)).toEqual({ read: true, write: false, execute: true })
    expect(digitToPermission(0)).toEqual({ read: false, write: false, execute: false })
  })

  it('maps flags to a digit', () => {
    expect(permissionDigit({ read: true, write: true, execute: true })).toBe(7)
    expect(permissionDigit({ read: true, write: false, execute: true })).toBe(5)
  })

  it('rejects out-of-range digits', () => {
    expect(() => digitToPermission(8)).toThrow(ChmodError)
  })
})

describe('octal', () => {
  it('parses 3-digit notation', () => {
    const permissions = fromOctal('644')
    expect(permissions.owner).toEqual({ read: true, write: true, execute: false })
    expect(permissions.group).toEqual({ read: true, write: false, execute: false })
    expect(permissions.other).toEqual({ read: true, write: false, execute: false })
    expect(toOctal(permissions)).toBe('0644')
  })

  it('parses 4-digit notation with special bits', () => {
    const permissions = fromOctal('1777')
    expect(permissions.special.sticky).toBe(true)
    expect(toOctal(permissions)).toBe('1777')
  })

  it('round-trips every preset', () => {
    for (const octal of ['644', '755', '600', '700', '777', '1777', '4755']) {
      expect(toOctal(fromOctal(octal))).toBe(octal.padStart(4, '0'))
    }
  })

  it('rejects invalid notation', () => {
    expect(() => fromOctal('99')).toThrow(ChmodError)
    expect(() => fromOctal('abcd')).toThrow(ChmodError)
  })
})

describe('symbolic', () => {
  it('renders rwx triples', () => {
    expect(toSymbolic(fromOctal('755'))).toBe('rwxr-xr-x')
    expect(toSymbolic(fromOctal('644'))).toBe('rw-r--r--')
  })

  it('renders special bits in lower case when execute is set', () => {
    expect(toSymbolic(fromOctal('4755'))).toBe('rwsr-xr-x')
    expect(toSymbolic(fromOctal('1777'))).toBe('rwxrwxrwt')
  })

  it('renders special bits in upper case when execute is clear', () => {
    expect(toSymbolic(fromOctal('4644'))).toBe('rwSr--r--')
  })

  it('parses symbolic notation', () => {
    expect(toOctal(fromSymbolic('rwxr-xr-x'))).toBe('0755')
    expect(toOctal(fromSymbolic('rwSr--r--'))).toBe('4644')
  })

  it('round-trips octal to symbolic to octal', () => {
    for (const octal of ['644', '755', '600', '700', '1777', '4755', '4644']) {
      expect(toOctal(fromSymbolic(toSymbolic(fromOctal(octal))))).toBe(octal.padStart(4, '0'))
    }
  })

  it('rejects wrong-length symbolic strings', () => {
    expect(() => fromSymbolic('rwxr-xr')).toThrow(ChmodError)
    expect(() => fromSymbolic('abcdefghi')).toThrow(ChmodError)
  })
})

describe('explain', () => {
  it('describes each class and the special bits', () => {
    const result = explain(fromOctal('4755'))
    expect(result.owner).toBe('read, write, execute')
    expect(result.group).toBe('read, execute')
    expect(result.other).toBe('read, execute')
    expect(result.special[0]).toMatch(/setuid/)
    expect(result.commands).toContain('chmod 4755')
  })

  it('says no access when a class has nothing', () => {
    expect(explain(fromOctal('700')).group).toBe('no access')
  })
})

describe('emptyPermissions', () => {
  it('starts with no bits set', () => {
    expect(toOctal(emptyPermissions())).toBe('0000')
  })
})
