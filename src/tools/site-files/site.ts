/**
 * robots.txt and sitemap.xml generation and checking.
 *
 * Both formats are plain text with strict enough rules to be worth validating:
 * robots.txt is grouped by user-agent, and a sitemap must be well-formed XML
 * with absolute URLs. Everything here is pure string work.
 */

export class SiteFileError extends Error {}

const CHANGEFREQ = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'] as const
export type ChangeFreq = (typeof CHANGEFREQ)[number]

/* --------------------------------- robots.txt -------------------------------- */

export interface RobotsGroup {
  userAgent: string
  disallow: string[]
  allow: string[]
  crawlDelay?: number
}

export interface RobotsConfig {
  groups: RobotsGroup[]
  sitemaps: string[]
  host?: string
}

export interface RobotsParse {
  groups: RobotsGroup[]
  sitemaps: string[]
  warnings: string[]
}

/** Serialise a robots.txt configuration. */
export function buildRobots(config: RobotsConfig): string {
  const blocks: string[] = []
  for (const group of config.groups) {
    const lines: string[] = [`User-agent: ${group.userAgent || '*'}`]
    for (const path of group.allow ?? []) lines.push(`Allow: ${path}`)
    for (const path of group.disallow ?? []) lines.push(`Disallow: ${path}`)
    if (group.crawlDelay !== undefined && group.crawlDelay > 0) lines.push(`Crawl-delay: ${group.crawlDelay}`)
    blocks.push(lines.join('\n'))
  }
  const parts = [...blocks]
  if (config.host) parts.push(`Host: ${config.host}`)
  if (config.sitemaps.length) parts.push(config.sitemaps.map((url) => `Sitemap: ${url}`).join('\n'))
  return `${parts.join('\n\n').trim()}\n`
}

/** Parse a robots.txt into groups, and flag the mistakes people actually make. */
export function parseRobots(text: string): RobotsParse {
  const groups: RobotsGroup[] = []
  const sitemaps: string[] = []
  const warnings: string[] = []
  let current: RobotsGroup | null = null
  let sawRuleBeforeAgent = false
  let lastDirective = ''
  let lineNumber = 0

  for (const rawLine of text.split(/\r\n?|\n/)) {
    lineNumber++
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const separator = line.indexOf(':')
    if (separator === -1) {
      warnings.push(`Line ${lineNumber}: "${line}" is not "directive: value".`)
      continue
    }
    const directive = line.slice(0, separator).trim().toLowerCase()
    const value = line.slice(separator + 1).trim()

    if (directive === 'user-agent' || directive === 'useragent') {
      if (lastDirective === 'user-agent') {
        // Consecutive User-agent lines share one group.
        groups[groups.length - 1].userAgent += `, ${value}`
      } else {
        current = { userAgent: value, disallow: [], allow: [] }
        groups.push(current)
      }
    } else if (directive === 'disallow') {
      if (!current) {
        sawRuleBeforeAgent = true
        continue
      }
      if (value) current.disallow.push(value)
    } else if (directive === 'allow') {
      if (!current) {
        sawRuleBeforeAgent = true
        continue
      }
      if (value) current.allow.push(value)
    } else if (directive === 'crawl-delay') {
      const delay = Number(value)
      if (current && Number.isFinite(delay)) current.crawlDelay = delay
    } else if (directive === 'sitemap') {
      sitemaps.push(value)
    } else {
      warnings.push(`Line ${lineNumber}: unknown directive "${directive}".`)
    }
    lastDirective = directive
  }

  if (sawRuleBeforeAgent) warnings.push('Allow/Disallow rules appeared before any User-agent line and were ignored.')
  if (!groups.length) warnings.push('No User-agent line found; crawlers will assume "*" is fully allowed.')
  for (const url of sitemaps) {
    if (!/^https?:\/\//i.test(url)) warnings.push(`Sitemap "${url}" should be an absolute URL.`)
  }

  return { groups, sitemaps, warnings }
}

/* --------------------------------- sitemap.xml ------------------------------- */

export interface SitemapUrl {
  loc: string
  lastmod?: string
  changefreq?: ChangeFreq
  priority?: number
}

export interface SitemapParse {
  urls: SitemapUrl[]
  warnings: string[]
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** Serialise a sitemap. `pretty` indents each `<url>` block for readability. */
export function buildSitemap(urls: SitemapUrl[], options: { pretty?: boolean } = {}): string {
  const pretty = options.pretty ?? true
  const body = urls.map((url) => {
    const parts = [`<loc>${escapeXml(url.loc)}</loc>`]
    if (url.lastmod) parts.push(`<lastmod>${escapeXml(url.lastmod)}</lastmod>`)
    if (url.changefreq) parts.push(`<changefreq>${url.changefreq}</changefreq>`)
    if (url.priority !== undefined) parts.push(`<priority>${url.priority.toFixed(1)}</priority>`)
    return pretty
      ? `  <url>\n    ${parts.join('\n    ')}\n  </url>`
      : `  <url>${parts.join('')}</url>`
  })
  const inner = body.join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${inner}\n</urlset>\n`
}

/** Parse a sitemap and flag the usual problems: HTTP URLs, bad dates, duplicates. */
export function parseSitemap(xml: string): SitemapParse {
  if (!/<urlset[\s>]/i.test(xml)) throw new SiteFileError('No <urlset> element found, so this is not a sitemap.')
  const urls: SitemapUrl[] = []
  const warnings: string[] = []
  const seen = new Set<string>()

  for (const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const block = match[1]
    const pick = (tag: string) => {
      const found = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(block)
      return found ? unescapeXml(found[1].trim()) : undefined
    }
    const loc = pick('loc')
    if (!loc) {
      warnings.push('A <url> block has no <loc> and was skipped.')
      continue
    }
    const url: SitemapUrl = { loc }
    const lastmod = pick('lastmod')
    if (lastmod) {
      if (!/^\d{4}-\d{2}-\d{2}/.test(lastmod) || Number.isNaN(Date.parse(lastmod))) {
        warnings.push(`"${lastmod}" is not a valid lastmod date.`)
      } else {
        url.lastmod = lastmod
      }
    }
    const changefreq = pick('changefreq')?.toLowerCase()
    if (changefreq) {
      if ((CHANGEFREQ as readonly string[]).includes(changefreq)) url.changefreq = changefreq as ChangeFreq
      else warnings.push(`"${changefreq}" is not a valid changefreq.`)
    }
    const priority = pick('priority')
    if (priority !== undefined) {
      const value = Number(priority)
      if (!Number.isFinite(value) || value < 0 || value > 1) warnings.push(`Priority "${priority}" should be between 0.0 and 1.0.`)
      else url.priority = value
    }

    if (seen.has(loc)) warnings.push(`Duplicate URL: ${loc}`)
    seen.add(loc)
    if (loc.startsWith('http://')) warnings.push(`"${loc}" uses http:// — sitemaps should use https://.`)
    urls.push(url)
  }

  if (!urls.length) warnings.push('The sitemap has no <url> entries.')
  if (urls.length > 50000) warnings.push(`${urls.length} URLs exceeds the 50,000-per-file limit; add a sitemap index.`)
  return { urls, warnings }
}

/** Turn a plain newline-separated list of URLs into sitemap entries. */
export function urlsFromLines(text: string): SitemapUrl[] {
  return text
    .split(/\r\n?|\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [loc, lastmod] = line.split(/\s+/)
      const url: SitemapUrl = { loc }
      if (lastmod && /^\d{4}-\d{2}-\d{2}/.test(lastmod)) url.lastmod = lastmod
      return url
    })
}
