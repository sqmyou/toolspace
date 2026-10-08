/** IPv4/IPv6 parsing plus subnet maths, using BigInt so both widths are uniform. */

export function parseIPv4(input: string): number {
  const parts = input.trim().split('.')
  if (parts.length !== 4) throw new Error('An IPv4 address needs four octets')
  let value = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) throw new Error(`Invalid octet "${part}"`)
    const octet = Number(part)
    if (octet > 255) throw new Error(`Octet ${octet} is out of range`)
    value = (value << 8) | octet
  }
  return value >>> 0
}

export function formatIPv4(value: number): string {
  const v = value >>> 0
  return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].join('.')
}

function parseHextet(hextet: string): number {
  if (!/^[0-9a-f]{1,4}$/.test(hextet)) throw new Error(`Invalid hextet "${hextet}"`)
  return parseInt(hextet, 16)
}

export function parseIPv6(input: string): bigint {
  let str = input.trim().toLowerCase()
  if (!str) throw new Error('Enter an IPv6 address')

  if (str.includes('.')) {
    const colon = str.lastIndexOf(':')
    const quad = parseIPv4(str.slice(colon + 1))
    str = `${str.slice(0, colon + 1)}${((quad >>> 16) & 0xffff).toString(16)}:${(quad & 0xffff).toString(16)}`
  }

  const halves = str.split('::')
  if (halves.length > 2) throw new Error('An IPv6 address can contain "::" only once')

  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const headGroups = head.map(parseHextet)
  const tailGroups = tail.map(parseHextet)

  let groups: number[]
  if (halves.length === 2) {
    const missing = 8 - headGroups.length - tailGroups.length
    if (missing < 0) throw new Error('Too many groups for an IPv6 address')
    groups = [...headGroups, ...new Array(missing).fill(0), ...tailGroups]
  } else {
    if (headGroups.length !== 8) throw new Error('An IPv6 address must have eight groups')
    groups = headGroups
  }

  let value = 0n
  for (const group of groups) value = (value << 16n) | BigInt(group)
  return value
}

export function formatIPv6(value: bigint): string {
  const groups: number[] = []
  for (let i = 7; i >= 0; i--) groups.push(Number((value >> BigInt(i * 16)) & 0xffffn))

  let bestStart = -1
  let bestLength = 0
  let curStart = -1
  let curLength = 0
  for (let i = 0; i < 8; i++) {
    if (groups[i] === 0) {
      if (curStart < 0) curStart = i
      curLength++
      if (curLength > bestLength) {
        bestLength = curLength
        bestStart = curStart
      }
    } else {
      curStart = -1
      curLength = 0
    }
  }
  if (bestLength < 2) bestStart = -1

  const hex = groups.map((group) => group.toString(16))
  if (bestStart < 0) return hex.join(':')
  return `${hex.slice(0, bestStart).join(':')}::${hex.slice(bestStart + bestLength).join(':')}`
}

export interface ParsedCidr {
  version: 4 | 6
  value: bigint
  prefix: number
  maxPrefix: number
}

export function parseCidr(input: string): ParsedCidr {
  const [address, prefixPart, ...rest] = input.trim().split('/')
  if (rest.length > 0) throw new Error('Use a single "/" for the prefix')
  if (!address) throw new Error('Enter an address')

  const version: 4 | 6 = address.includes(':') ? 6 : 4
  const maxPrefix = version === 4 ? 32 : 128
  const prefix = prefixPart === undefined || prefixPart === '' ? maxPrefix : Number(prefixPart)
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxPrefix) {
    throw new Error(`Prefix must be between 0 and ${maxPrefix}`)
  }

  const value = version === 4 ? BigInt(parseIPv4(address)) : parseIPv6(address)
  return { version, value, prefix, maxPrefix }
}

export interface SubnetInfo {
  version: 4 | 6
  address: string
  prefix: number
  network: string
  broadcast: string
  first: string
  last: string
  netmask: string
  wildcard: string
  hostCount: string
  isPrivate: boolean
}

const PRIVATE_V4 = [
  { network: '10.0.0.0', prefix: 8 },
  { network: '172.16.0.0', prefix: 12 },
  { network: '192.168.0.0', prefix: 16 },
  { network: '127.0.0.0', prefix: 8 },
  { network: '169.254.0.0', prefix: 16 },
]

function isPrivateV4(value: bigint): boolean {
  return PRIVATE_V4.some(({ network, prefix }) => {
    const mask = maskFor(32, prefix)
    return (value & mask) === (BigInt(parseIPv4(network)) & mask)
  })
}

function maskFor(bits: number, prefix: number): bigint {
  return ((1n << BigInt(bits)) - 1n) ^ ((1n << BigInt(bits - prefix)) - 1n)
}

function formatValue(version: 4 | 6, value: bigint): string {
  return version === 4 ? formatIPv4(Number(value)) : formatIPv6(value)
}

export function computeSubnet(input: string): SubnetInfo {
  const { version, value, prefix, maxPrefix } = parseCidr(input)
  const hostBits = maxPrefix - prefix
  const mask = maskFor(maxPrefix, prefix)
  const inversion = (1n << BigInt(hostBits)) - 1n

  const network = value & mask
  const broadcast = network | inversion

  // A /31 or /32 has no usable "middle" range; RFC 3021 treats both as hosts.
  const widelyUsable = hostBits >= 2
  const first = widelyUsable ? network + 1n : network
  const last = widelyUsable ? broadcast - 1n : broadcast
  const hostCount = 1n << BigInt(hostBits)

  return {
    version,
    address: formatValue(version, value),
    prefix,
    network: formatValue(version, network),
    broadcast: formatValue(version, broadcast),
    first: formatValue(version, first),
    last: formatValue(version, last),
    netmask: formatValue(version, mask),
    wildcard: formatValue(version, inversion),
    hostCount: hostCount.toString(),
    isPrivate: version === 4 ? isPrivateV4(value) : [0xfc, 0xfd].includes(Number(network >> 120n)),
  }
}
