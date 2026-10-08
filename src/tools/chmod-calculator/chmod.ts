/** Unix file permission maths: numeric, symbolic and rwx notation. */

export interface Permission {
  read: boolean
  write: boolean
  execute: boolean
}

export interface Permissions {
  owner: Permission
  group: Permission
  other: Permission
  /** setuid, setgid, sticky — the leading octal digit. */
  special: { setuid: boolean; setgid: boolean; sticky: boolean }
}

export class ChmodError extends Error {}

const NAMES = ['owner', 'group', 'other'] as const
export type Who = (typeof NAMES)[number]

function clampDigit(value: number): number {
  if (value < 0 || value > 7) throw new ChmodError('Each permission digit must be between 0 and 7.')
  return value
}

export function emptyPermissions(): Permissions {
  return {
    owner: { read: false, write: false, execute: false },
    group: { read: false, write: false, execute: false },
    other: { read: false, write: false, execute: false },
    special: { setuid: false, setgid: false, sticky: false },
  }
}

export function permissionDigit(permission: Permission): number {
  return (permission.read ? 4 : 0) + (permission.write ? 2 : 0) + (permission.execute ? 1 : 0)
}

export function digitToPermission(digit: number): Permission {
  clampDigit(digit)
  return { read: (digit & 4) !== 0, write: (digit & 2) !== 0, execute: (digit & 1) !== 0 }
}

export function toOctal(permissions: Permissions): string {
  const special =
    (permissions.special.setuid ? 4 : 0) + (permissions.special.setgid ? 2 : 0) + (permissions.special.sticky ? 1 : 0)
  const digits = NAMES.map((who) => permissionDigit(permissions[who]))
  return `${special}${digits.join('')}`
}

/** Parse 3- or 4-digit octal notation (with an optional leading 0). */
export function fromOctal(input: string): Permissions {
  const digits = input.trim().replace(/^0o/i, '')
  if (!/^[0-7]{3,4}$/.test(digits)) throw new ChmodError('Octal notation must be 3 or 4 digits, each 0–7.')
  const padded = digits.padStart(4, '0')
  const special = Number(padded[0])
  const permissions = emptyPermissions()
  permissions.special = { setuid: (special & 4) !== 0, setgid: (special & 2) !== 0, sticky: (special & 1) !== 0 }
  NAMES.forEach((who, index) => {
    permissions[who] = digitToPermission(Number(padded[index + 1]))
  })
  return permissions
}

const SPECIAL_CHAR: Record<Who, string> = { owner: 's', group: 's', other: 't' }

export function toSymbolic(permissions: Permissions): string {
  return NAMES.map((who) => {
    const permission = permissions[who]
    const specialOn =
      who === 'owner' ? permissions.special.setuid : who === 'group' ? permissions.special.setgid : permissions.special.sticky
    const read = permission.read ? 'r' : '-'
    const write = permission.write ? 'w' : '-'
    // The special flag replaces the execute slot: lower case when execute is
    // also set, upper case when it is not.
    let execute: string
    if (specialOn) execute = permission.execute ? SPECIAL_CHAR[who] : SPECIAL_CHAR[who].toUpperCase()
    else execute = permission.execute ? 'x' : '-'
    return read + write + execute
  }).join('')
}

/** Parse a symbolic string such as `rwxr-xr-x` or `rwSr--r--`. */
export function fromSymbolic(input: string): Permissions {
  const text = input.trim()
  if (!/^[rwxsStT-]{9}$/.test(text)) throw new ChmodError('Symbolic notation must be exactly 9 characters, e.g. rwxr-xr-x.')
  const permissions = emptyPermissions()
  NAMES.forEach((who, index) => {
    const chunk = text.slice(index * 3, index * 3 + 3)
    permissions[who] = {
      read: chunk[0] === 'r',
      write: chunk[1] === 'w',
      execute: chunk[2] === 'x' || chunk[2] === 's' || chunk[2] === 't',
    }
  })
  permissions.special = {
    setuid: text[2] === 's' || text[2] === 'S',
    setgid: text[5] === 's' || text[5] === 'S',
    sticky: text[8] === 't' || text[8] === 'T',
  }
  return permissions
}

export interface Explanation {
  owner: string
  group: string
  other: string
  special: string[]
  commands: string
}

const VERBS: Record<string, string> = { read: 'read', write: 'write', execute: 'execute' }

function describe(permission: Permission): string {
  const granted = (Object.keys(VERBS) as (keyof Permission)[]).filter((key) => permission[key]).map((key) => VERBS[key])
  return granted.length ? granted.join(', ') : 'no access'
}

export function explain(permissions: Permissions): Explanation {
  const special: string[] = []
  if (permissions.special.setuid) special.push('setuid — the file runs with the owner’s privileges')
  if (permissions.special.setgid) special.push('setgid — the file runs with the group’s privileges (or new files inherit the directory group)')
  if (permissions.special.sticky) special.push('sticky — only owners may delete entries in the directory')
  const octal = toOctal(permissions)
  const symbolic = toSymbolic(permissions)
  return {
    owner: describe(permissions.owner),
    group: describe(permissions.group),
    other: describe(permissions.other),
    special,
    commands: `chmod ${octal} file.txt\nchmod ${symbolic} file.txt`,
  }
}

/** A few well-known permission sets, handy as presets. */
export const PRESETS: { label: string; octal: string }[] = [
  { label: '644 — owner writes, everyone reads', octal: '644' },
  { label: '755 — scripts and directories', octal: '755' },
  { label: '600 — private file', octal: '600' },
  { label: '700 — private directory', octal: '700' },
  { label: '777 — world-writable (avoid)', octal: '777' },
  { label: '1777 — shared temp directory', octal: '1777' },
  { label: '4755 — setuid executable', octal: '4755' },
]
