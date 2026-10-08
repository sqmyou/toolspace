/** Seeded fake-data generation. Values are clearly synthetic, not real people. */

export type FieldKey =
  | 'id'
  | 'firstName'
  | 'lastName'
  | 'fullName'
  | 'email'
  | 'username'
  | 'phone'
  | 'company'
  | 'jobTitle'
  | 'street'
  | 'city'
  | 'country'
  | 'postcode'
  | 'birthday'
  | 'uuid'

export const FIELD_LABELS: Record<FieldKey, string> = {
  id: 'ID',
  firstName: 'First name',
  lastName: 'Last name',
  fullName: 'Full name',
  email: 'Email',
  username: 'Username',
  phone: 'Phone',
  company: 'Company',
  jobTitle: 'Job title',
  street: 'Street',
  city: 'City',
  country: 'Country',
  postcode: 'Postcode',
  birthday: 'Birthday',
  uuid: 'UUID',
}

const FIRST_NAMES = ['Ada', 'Grace', 'Alan', 'Linus', 'Radia', 'Barbara', 'Ken', 'Margaret', 'Dennis', 'Katherine', 'Tim', 'Shafi', 'Yann', 'Anita', 'Guido', 'Bjarne', 'Anders', 'Sophie', 'Nadia', 'Ravi', 'Mei', 'Omar', 'Lena', 'Tomás', 'Aisha', 'Diego', 'Ingrid', 'Kwame']
const LAST_NAMES = ['Lovelace', 'Hopper', 'Turing', 'Torvalds', 'Perlman', 'Liskov', 'Thompson', 'Hamilton', 'Ritchie', 'Johnson', 'Berners-Lee', 'Goldwasser', 'LeCun', 'Borg', 'van Rossum', 'Stroustrup', 'Hejlsberg', 'Kovacs', 'Okafor', 'Patel', 'Zhang', 'Haddad', 'Novak', 'Silva', 'Ahmed', 'Fernandez', 'Larsen', 'Mensah']
const COMPANIES = ['Northwind Labs', 'Cobalt Systems', 'Redwood Analytics', 'Quanta Works', 'Lighthouse Software', 'Riverbank Data', 'Ironwood Cloud', 'Beacon Interactive', 'Summit Robotics', 'Bluefin Networks']
const JOBS = ['Software Engineer', 'Data Scientist', 'Product Manager', 'Designer', 'Site Reliability Engineer', 'Security Analyst', 'Technical Writer', 'QA Engineer', 'Engineering Manager', 'Support Specialist']
const STREETS = ['Maple Avenue', 'Oak Street', 'Cedar Lane', 'Birch Road', 'Willow Way', 'Aspen Court', 'Juniper Drive', 'Alder Place']
const CITIES = ['Springfield', 'Riverton', 'Fairview', 'Greenfield', 'Lakeside', 'Brookhaven', 'Kingsport', 'Cedar Falls']
const COUNTRIES = ['United Kingdom', 'United States', 'Canada', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Sweden', 'Japan', 'Australia', 'Brazil']
const TLD = ['example.com', 'example.org', 'example.net', 'test.example']

/** mulberry32 — small, fast, deterministic given a seed. */
export function makeRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(random: () => number, items: T[]): T {
  return items[Math.floor(random() * items.length)]
}

function digits(random: () => number, length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) out += Math.floor(random() * 10)
  return out
}

function uuidFrom(random: () => number): string {
  let hex = ''
  for (let i = 0; i < 32; i++) hex += '0123456789abcdef'[Math.floor(random() * 16)]
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`
}

export function generateRow(fields: FieldKey[], random: () => number, index: number): Record<string, string> {
  const first = pick(random, FIRST_NAMES)
  const last = pick(random, LAST_NAMES)
  const domain = pick(random, TLD)

  const factories: Record<FieldKey, () => string> = {
    id: () => String(index + 1),
    firstName: () => first,
    lastName: () => last,
    fullName: () => `${first} ${last}`,
    email: () => `${first}.${last}${index + 1}@${domain}`.toLowerCase(),
    username: () => `${first[0]}${last}${Math.floor(random() * 100)}`.toLowerCase().replace(/[^a-z0-9]/g, ''),
    phone: () => `+1 ${digits(random, 3)} ${digits(random, 3)} ${digits(random, 4)}`,
    company: () => pick(random, COMPANIES),
    jobTitle: () => pick(random, JOBS),
    street: () => `${1 + Math.floor(random() * 900)} ${pick(random, STREETS)}`,
    city: () => pick(random, CITIES),
    country: () => pick(random, COUNTRIES),
    postcode: () => `${digits(random, 5)}`,
    birthday: () => {
      const year = 1950 + Math.floor(random() * 55)
      const month = String(1 + Math.floor(random() * 12)).padStart(2, '0')
      const day = String(1 + Math.floor(random() * 28)).padStart(2, '0')
      return `${year}-${month}-${day}`
    },
    uuid: () => uuidFrom(random),
  }

  const row: Record<string, string> = {}
  for (const field of fields) row[field] = factories[field]()
  return row
}

export interface GenerateOptions {
  fields: FieldKey[]
  count: number
  seed: number
}

export function generateRows({ fields, count, seed }: GenerateOptions): Record<string, string>[] {
  const random = makeRandom(seed)
  const safe = Math.max(1, Math.min(500, Math.floor(count)))
  return Array.from({ length: safe }, (_, index) => generateRow(fields, random, index))
}

function escapeCsv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function toCsv(rows: Record<string, string>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]
  for (const row of rows) lines.push(headers.map((header) => escapeCsv(row[header] ?? '')).join(','))
  return lines.join('\n')
}

export function toJson(rows: Record<string, string>[]): string {
  return JSON.stringify(rows, null, 2)
}
