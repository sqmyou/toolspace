import { describe, expect, it } from 'vitest'
import { checkPort, checkVolume, ComposeError, parseYaml, validateCompose } from './compose'

const GOOD = `services:
  web:
    image: nginx:1.27
    ports:
      - "8080:80"
    volumes:
      - ./site:/usr/share/nginx/html:ro
    depends_on:
      - api
    restart: unless-stopped
    environment:
      - NGINX_HOST=example.com
  api:
    build:
      context: ./api
    networks:
      - backend
networks:
  backend:
volumes:
  data:
`

describe('parseYaml', () => {
  it('reads nested mappings', () => {
    expect(parseYaml('a:\n  b: 1\n  c: two')).toEqual({ value: { a: { b: 1, c: 'two' } }, duplicates: [] })
  })

  it('reads block sequences', () => {
    expect(parseYaml('list:\n  - one\n  - two').value).toEqual({ list: ['one', 'two'] })
  })

  it('reads a mapping inside a sequence', () => {
    const value = parseYaml('items:\n  - name: a\n    size: 1\n  - name: b') as { value: { items: unknown[] } }
    expect(value.value.items).toEqual([{ name: 'a', size: 1 }, { name: 'b' }])
  })

  it('reads flow collections and scalars', () => {
    const value = parseYaml('a: [1, 2]\nb: {x: 1, y: "two"}\nc: true\nd: null\ne: 3.5').value as Record<string, unknown>
    expect(value.a).toEqual([1, 2])
    expect(value.b).toEqual({ x: 1, y: 'two' })
    expect(value.c).toBe(true)
    expect(value.d).toBeNull()
    expect(value.e).toBe(3.5)
  })

  it('drops comments and blank lines', () => {
    expect(parseYaml('# note\n\na: 1 # trailing').value).toEqual({ a: 1 })
  })

  it('keeps a hash inside quotes', () => {
    expect(parseYaml('a: "x # y"').value).toEqual({ a: 'x # y' })
  })

  it('reports duplicate keys', () => {
    expect(parseYaml('a: 1\na: 2').duplicates).toEqual(['a'])
  })

  it('rejects tabs used for indentation', () => {
    expect(() => parseYaml('a:\n\tb: 1')).toThrow(ComposeError)
  })

  it('rejects a line with no colon in a mapping', () => {
    expect(() => parseYaml('a: 1\njust text')).toThrow(ComposeError)
  })
})

describe('checkPort', () => {
  it('accepts the common forms', () => {
    expect(checkPort('80')).toBeNull()
    expect(checkPort('8080:80')).toBeNull()
    expect(checkPort('127.0.0.1:8080:80')).toBeNull()
    expect(checkPort('8080:80/udp')).toBeNull()
    expect(checkPort('3000-3005:3000-3005')).toBeNull()
    expect(checkPort(8080)).toBeNull()
    expect(checkPort('${PORT}:80')).toBeNull()
    expect(checkPort({ target: 80, published: '8080' })).toBeNull()
  })

  it('rejects out-of-range and malformed entries', () => {
    expect(checkPort('0')).toMatch(/valid port/)
    expect(checkPort('70000')).toMatch(/valid port/)
    expect(checkPort('a:b:c:d')).toMatch(/too many parts/)
    expect(checkPort('8080:')).toMatch(/empty part/)
    expect(checkPort({ published: 8080 })).toMatch(/target/)
    expect(checkPort({ target: 80, protocol: 'sctp' })).toMatch(/tcp or udp/)
  })
})

describe('checkVolume', () => {
  it('accepts the common forms', () => {
    expect(checkVolume('./src:/app')).toBeNull()
    expect(checkVolume('/data')).toBeNull()
    expect(checkVolume('cache:/var/cache:ro')).toBeNull()
    expect(checkVolume('data:/var/lib/data:ro,nocopy')).toBeNull()
    expect(checkVolume({ type: 'bind', source: './x', target: '/y' })).toBeNull()
  })

  it('rejects bad modes and long forms', () => {
    expect(checkVolume('a:/b:rwx')).toMatch(/Unknown volume mode/)
    expect(checkVolume({ type: 'bind', target: '/y' })).toMatch(/needs a source/)
    expect(checkVolume({ type: 'nonsense', target: '/y' })).toMatch(/Unknown volume type/)
    expect(checkVolume({ type: 'volume' })).toMatch(/needs a target/)
  })
})

describe('validateCompose', () => {
  it('passes a sound file', () => {
    const result = validateCompose(GOOD)
    expect(result.errorCount).toBe(0)
    expect(result.services).toEqual(['web', 'api'])
    expect(result.networks).toEqual(['backend'])
    expect(result.volumes).toEqual(['data'])
  })

  it('requires a services section', () => {
    const result = validateCompose('version: "3"\n')
    expect(result.issues.some((issue) => issue.level === 'error' && /services/.test(issue.message))).toBe(true)
    expect(result.services).toEqual([])
  })

  it('requires an image or a build', () => {
    const result = validateCompose('services:\n  web:\n    ports:\n      - "80"')
    expect(result.issues.some((issue) => issue.level === 'error' && /image or a build/.test(issue.message))).toBe(true)
  })

  it('warns about an untagged image', () => {
    const result = validateCompose('services:\n  web:\n    image: nginx')
    expect(result.issues.some((issue) => issue.level === 'warning' && /no tag/.test(issue.message))).toBe(true)
  })

  it('flags a bad port with its index', () => {
    const result = validateCompose('services:\n  web:\n    image: nginx:1\n    ports:\n      - "80"\n      - "not-a-port"')
    const issue = result.issues.find((entry) => entry.path === 'services.web.ports[1]')
    expect(issue?.level).toBe('error')
  })

  it('flags a bad restart policy', () => {
    const result = validateCompose('services:\n  web:\n    image: nginx:1\n    restart: sometimes')
    expect(result.issues.some((issue) => issue.path === 'services.web.restart')).toBe(true)
  })

  it('flags a bad depends_on condition', () => {
    const result = validateCompose('services:\n  web:\n    image: nginx:1\n    depends_on:\n      db:\n        condition: service_ok')
    expect(result.issues.some((issue) => /unknown condition/.test(issue.message))).toBe(true)
  })

  it('accepts the short and long depends_on forms', () => {
    expect(validateCompose('services:\n  web:\n    image: nginx:1\n    depends_on:\n      - db\n  db:\n    image: postgres:16').errorCount).toBe(0)
    expect(validateCompose('services:\n  web:\n    image: nginx:1\n    depends_on:\n      db:\n        condition: service_healthy\n  db:\n    image: postgres:16').errorCount).toBe(0)
  })

  it('flags bad environment entries', () => {
    expect(validateCompose('services:\n  web:\n    image: nginx:1\n    environment:\n      - 1BAD=x').errorCount).toBe(1)
    expect(validateCompose('services:\n  web:\n    image: nginx:1\n    environment:\n      GOOD: x').errorCount).toBe(0)
  })

  it('warns about an unknown service key and top-level key', () => {
    const result = validateCompose('weird: 1\nservices:\n  web:\n    image: nginx:1\n    images: nginx')
    expect(result.issues.some((issue) => issue.path === 'weird')).toBe(true)
    expect(result.issues.some((issue) => issue.path === 'services.web.images')).toBe(true)
  })

  it('warns about the obsolete version field', () => {
    expect(validateCompose('version: "3.8"\nservices:\n  web:\n    image: nginx:1').issues.some((issue) => /obsolete/.test(issue.message))).toBe(true)
  })

  it('warns when a named network or volume is not declared', () => {
    const result = validateCompose('services:\n  web:\n    image: nginx:1\n    networks:\n      - missing\nnetworks:\n  other:')
    expect(result.issues.some((issue) => /not defined at the top level/.test(issue.message))).toBe(true)
  })

  it('warns about a privileged service', () => {
    expect(validateCompose('services:\n  web:\n    image: nginx:1\n    privileged: true').issues.some((issue) => /full access/.test(issue.message))).toBe(true)
  })

  it('turns a parse failure into an error issue', () => {
    const result = validateCompose('services:\n  web:\n    image: nginx:1\n\tbad: 1')
    expect(result.errorCount).toBe(1)
    expect(result.services).toEqual([])
  })

  it('counts errors and warnings separately', () => {
    const result = validateCompose('version: "3"\nservices:\n  web:\n    restart: nope')
    // Two errors: no image or build, and the bad restart policy. One warning:
    // the obsolete version field.
    expect(result.errorCount).toBe(2)
    expect(result.warningCount).toBe(1)
  })
})
