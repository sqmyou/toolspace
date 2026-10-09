import { describe, expect, it } from 'vitest'
import { buildRobots, buildSitemap, parseRobots, parseSitemap, SiteFileError, urlsFromLines } from './site'

describe('robots.txt', () => {
  it('builds groups with allow, disallow and crawl-delay', () => {
    const text = buildRobots({
      groups: [
        { userAgent: '*', disallow: ['/admin', '/private'], allow: ['/admin/public'] },
        { userAgent: 'GPTBot', disallow: ['/'], allow: [], crawlDelay: 10 },
      ],
      sitemaps: ['https://x.dev/sitemap.xml'],
      host: 'x.dev',
    })
    expect(text).toContain('User-agent: *')
    expect(text).toContain('Allow: /admin/public')
    expect(text).toContain('Disallow: /private')
    expect(text).toContain('User-agent: GPTBot\nDisallow: /\nCrawl-delay: 10')
    expect(text).toContain('Sitemap: https://x.dev/sitemap.xml')
    expect(text).toContain('Host: x.dev')
  })

  it('round-trips through the parser', () => {
    const text = buildRobots({ groups: [{ userAgent: '*', disallow: ['/a'], allow: [] }], sitemaps: ['https://x.dev/s.xml'] })
    const parsed = parseRobots(text)
    expect(parsed.groups).toHaveLength(1)
    expect(parsed.groups[0].disallow).toEqual(['/a'])
    expect(parsed.sitemaps).toEqual(['https://x.dev/s.xml'])
  })

  it('ignores comments and blank lines', () => {
    const parsed = parseRobots('# comment\n\nUser-agent: *\nDisallow: /tmp # trailing\n')
    expect(parsed.groups[0].disallow).toEqual(['/tmp'])
    expect(parsed.warnings).toEqual([])
  })

  it('warns about rules before any user-agent', () => {
    const parsed = parseRobots('Disallow: /secret\nUser-agent: *\nDisallow: /')
    expect(parsed.warnings.some((warning) => /before any User-agent/.test(warning))).toBe(true)
    expect(parsed.groups[0].disallow).toEqual(['/'])
  })

  it('warns about an empty file and non-absolute sitemaps', () => {
    const empty = parseRobots('')
    expect(empty.warnings.some((warning) => /No User-agent/.test(warning))).toBe(true)
    const relative = parseRobots('User-agent: *\nSitemap: /sitemap.xml')
    expect(relative.warnings.some((warning) => /absolute URL/.test(warning))).toBe(true)
  })

  it('flags unknown directives', () => {
    const parsed = parseRobots('User-agent: *\nDisaalow: /oops')
    expect(parsed.warnings.some((warning) => /unknown directive/.test(warning))).toBe(true)
  })
})

describe('sitemap.xml', () => {
  const urls = [
    { loc: 'https://x.dev/', changefreq: 'weekly' as const, priority: 1, lastmod: '2024-05-01' },
    { loc: 'https://x.dev/about' },
  ]

  it('builds a well-formed urlset', () => {
    const xml = buildSitemap(urls)
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('<loc>https://x.dev/</loc>')
    expect(xml).toContain('<priority>1.0</priority>')
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true)
  })

  it('escapes dangerous characters in URLs', () => {
    const xml = buildSitemap([{ loc: 'https://x.dev/a?b=1&c=2' }], { pretty: false })
    expect(xml).toContain('a?b=1&amp;c=2')
  })

  it('round-trips through the parser', () => {
    const parsed = parseSitemap(buildSitemap(urls))
    expect(parsed.urls).toHaveLength(2)
    expect(parsed.urls[0]).toMatchObject({ loc: 'https://x.dev/', changefreq: 'weekly', priority: 1, lastmod: '2024-05-01' })
    expect(parsed.warnings).toEqual([])
  })

  it('rejects non-sitemap XML', () => {
    expect(() => parseSitemap('<root/>')).toThrow(SiteFileError)
  })

  it('flags duplicates, http URLs, bad dates and out-of-range priorities', () => {
    const xml = buildSitemap([
      { loc: 'http://x.dev/', lastmod: 'soon', changefreq: 'weekly', priority: 5 },
      { loc: 'http://x.dev/' },
    ])
    const warnings = parseSitemap(xml).warnings
    expect(warnings.some((warning) => /http:\/\//.test(warning))).toBe(true)
    expect(warnings.some((warning) => /Duplicate/.test(warning))).toBe(true)
    expect(warnings.some((warning) => /valid lastmod/.test(warning))).toBe(true)
    expect(warnings.some((warning) => /between 0.0 and 1.0/.test(warning))).toBe(true)
  })

  it('ignores invalid changefreq values', () => {
    const xml = '<urlset><url><loc>https://x.dev/</loc><changefreq>fortnightly</changefreq></url></urlset>'
    const parsed = parseSitemap(xml)
    expect(parsed.urls[0].changefreq).toBeUndefined()
    expect(parsed.warnings.some((warning) => /valid changefreq/.test(warning))).toBe(true)
  })
})

describe('urlsFromLines', () => {
  it('takes one URL per line, with an optional date', () => {
    expect(urlsFromLines('https://x.dev/\nhttps://x.dev/about 2024-05-01\n\n')).toEqual([
      { loc: 'https://x.dev/' },
      { loc: 'https://x.dev/about', lastmod: '2024-05-01' },
    ])
  })
})
