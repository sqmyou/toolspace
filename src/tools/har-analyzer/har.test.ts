import { describe, expect, it } from 'vitest'
import { analyseHar, formatBytes, formatDuration, HarError, mimeFamily, parseHar } from './har'

const HAR = JSON.stringify({
  log: {
    version: '1.2',
    creator: { name: 'Chrome DevTools', version: '120.0' },
    entries: [
      {
        startedDateTime: '2024-01-01T10:00:00.000Z',
        time: 120,
        request: { method: 'GET', url: 'https://example.com/' },
        response: {
          status: 200,
          statusText: 'OK',
          headers: [{ name: 'content-type', value: 'text/html' }],
          content: { size: 1024, mimeType: 'text/html; charset=utf-8' },
        },
      },
      {
        startedDateTime: '2024-01-01T10:00:00.050Z',
        time: 800,
        request: { method: 'GET', url: 'https://example.com/app.js?v=3' },
        response: {
          status: 200,
          headers: [
            { name: 'content-encoding', value: 'br' },
            { name: 'x-cache', value: 'HIT' },
          ],
          content: { size: 204800, mimeType: 'text/javascript' },
        },
      },
      {
        startedDateTime: '2024-01-01T10:00:00.900Z',
        time: 30,
        request: { method: 'GET', url: 'https://cdn.example.com/logo.png' },
        response: { status: 404, content: { size: -1, mimeType: 'image/png' } },
      },
      {
        startedDateTime: '2024-01-01T10:00:01.000Z',
        time: 15,
        request: { method: 'GET', url: 'http://insecure.example.com/track.gif' },
        response: { status: 302, content: { size: 0, mimeType: 'image/gif' } },
      },
    ],
  },
})

describe('parseHar', () => {
  it('accepts a valid HAR', () => {
    expect(parseHar(HAR).log?.entries).toHaveLength(4)
  })

  it('rejects non-JSON, non-objects and objects without a log', () => {
    expect(() => parseHar('nope')).toThrow(HarError)
    expect(() => parseHar('[]')).toThrow(HarError)
    expect(() => parseHar('{"foo":1}')).toThrow(/log/)
  })

  it('rejects entries that are not an array', () => {
    expect(() => parseHar('{"log":{"entries":{}}}')).toThrow(/array/)
  })
})

describe('analyseHar', () => {
  const report = analyseHar(parseHar(HAR))

  it('counts requests, bytes and total time', () => {
    expect(report.requestCount).toBe(4)
    expect(report.totalBytes).toBe(205824)
    expect(report.totalTimeMs).toBe(965)
    expect(report.version).toBe('1.2')
    expect(report.creator).toBe('Chrome DevTools 120.0')
  })

  it('measures the wall-clock span between the first and last request', () => {
    expect(report.pageSpanMs).toBe(1000)
  })

  it('ranks the slowest and heaviest requests', () => {
    expect(report.slowest[0].path).toBe('/app.js?v=3')
    expect(report.heaviest[0].size).toBe(204800)
  })

  it('groups by domain, type, method and status', () => {
    expect(report.domains.find((group) => group.label === 'example.com')?.count).toBe(2)
    expect(report.types.find((group) => group.label === 'script')?.bytes).toBe(204800)
    expect(report.methods[0]).toMatchObject({ label: 'GET', count: 4 })
    expect(report.statuses.map((group) => group.label).sort()).toEqual(['2xx', '3xx', '4xx'])
  })

  it('lists failures, redirects, cached and insecure requests', () => {
    expect(report.failures.map((row) => row.status)).toEqual([404])
    expect(report.redirects).toHaveLength(1)
    expect(report.cachedCount).toBe(1)
    expect(report.hasQueryStrings).toBe(1)
    expect(report.usesHttp.map((row) => row.host)).toEqual(['insecure.example.com'])
  })

  it('handles an empty HAR', () => {
    const empty = analyseHar({ log: { entries: [] } })
    expect(empty.requestCount).toBe(0)
    expect(empty.totalBytes).toBe(0)
    expect(empty.pageSpanMs).toBeNull()
    expect(empty.domains).toEqual([])
  })
})

describe('mimeFamily', () => {
  it('maps common types to families', () => {
    expect(mimeFamily('text/javascript; charset=utf-8')).toBe('script')
    expect(mimeFamily('application/javascript')).toBe('script')
    expect(mimeFamily('text/css')).toBe('css')
    expect(mimeFamily('image/png')).toBe('image')
    expect(mimeFamily('application/json')).toBe('data')
    expect(mimeFamily('font/woff2')).toBe('font')
    expect(mimeFamily('')).toBe('unknown')
  })
})

describe('formatters', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(204800)).toBe('205 kB')
    expect(formatBytes(1_500_000)).toBe('1.5 MB')
  })

  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0 ms')
    expect(formatDuration(820)).toBe('820 ms')
    expect(formatDuration(1240)).toBe('1.24 s')
  })
})
