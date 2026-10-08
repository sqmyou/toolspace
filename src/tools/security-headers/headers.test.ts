import { describe, expect, it } from 'vitest'
import { analyse, HEADERS, HeaderError, parseHeaders } from './headers'

const GOOD = `HTTP/1.1 200 OK
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin
X-XSS-Protection: 0`

describe('parseHeaders', () => {
  it('reads names and values case-insensitively', () => {
    const headers = parseHeaders('Content-Type: text/html\nx-frame-options: DENY')
    expect(headers.get('content-type')).toBe('text/html')
    expect(headers.get('x-frame-options')).toBe('DENY')
  })

  it('skips the status line and comments', () => {
    const headers = parseHeaders('HTTP/2 200\n# note\nServer: nginx')
    expect(headers.size).toBe(1)
    expect(headers.get('server')).toBe('nginx')
  })

  it('keeps a value that contains a colon', () => {
    expect(parseHeaders('Location: https://example.com/a:b').get('location')).toBe('https://example.com/a:b')
  })

  it('joins repeated headers', () => {
    expect(parseHeaders('Set-Cookie: a=1\nSet-Cookie: b=2').get('set-cookie')).toBe('a=1, b=2')
  })

  it('rejects input with no headers', () => {
    expect(() => parseHeaders('just some text')).toThrow(HeaderError)
    expect(() => parseHeaders('')).toThrow(HeaderError)
  })
})

describe('analyse', () => {
  it('scores a complete, strong set highly', () => {
    const report = analyse(GOOD)
    expect(report.score).toBe(100)
    expect(report.missing).toEqual([])
    expect(report.weak).toEqual([])
    expect(report.leaks).toEqual([])
  })

  it('reports missing headers', () => {
    const report = analyse('Content-Type: text/html')
    expect(report.missing).toContain('strict-transport-security')
    expect(report.missing).toContain('content-security-policy')
    expect(report.score).toBeLessThan(50)
  })

  it('flags a weak HSTS max-age', () => {
    const report = analyse('Strict-Transport-Security: max-age=60')
    const finding = report.findings.find((entry) => entry.name === 'strict-transport-security')
    expect(finding?.status).toBe('weak')
    expect(finding?.message).toMatch(/15552000/)
  })

  it('flags unsafe-inline in a policy', () => {
    const report = analyse("Content-Security-Policy: default-src 'self'; script-src 'unsafe-inline'")
    expect(report.weak).toContain('content-security-policy')
  })

  it('flags a wrong nosniff value', () => {
    expect(analyse('X-Content-Type-Options: sniff').weak).toContain('x-content-type-options')
  })

  it('accepts a couple of x-frame-options values only', () => {
    expect(analyse('X-Frame-Options: SAMEORIGIN').weak).toEqual([])
    expect(analyse('X-Frame-Options: ALLOWALL').weak).toContain('x-frame-options')
  })

  it('flags a leaking referrer policy', () => {
    expect(analyse('Referrer-Policy: unsafe-url').weak).toContain('referrer-policy')
    expect(analyse('Referrer-Policy: no-referrer').weak).toEqual([])
  })

  it('treats a revealing Server header as a leak, not a pass', () => {
    const report = analyse('Server: nginx/1.25.3')
    expect(report.leaks).toContain('server')
    expect(report.findings.find((entry) => entry.name === 'server')?.status).toBe('leaking')
  })

  it('does not count a leak header as missing', () => {
    const report = analyse('X-Content-Type-Options: nosniff')
    expect(report.missing).not.toContain('server')
  })

  it('marks every known header exactly once', () => {
    const report = analyse('Content-Type: text/html')
    expect(report.findings.map((finding) => finding.name)).toEqual(HEADERS.map((info) => info.name))
  })

  it('gives every finding a message', () => {
    for (const finding of analyse('Server: nginx').findings) expect(finding.message.length).toBeGreaterThan(0)
  })
})
