import {
  actions,
  button,
  copyButton,
  download,
  field,
  findings,
  findingRow,
  grid,
  note,
  outputBlock,
  panel,
  segmented,
  textarea,
  textField,
  toolLayout,
} from '../../core/components'

import type { Tool } from '../../core/types'
import {
  buildRobots,
  buildSitemap,
  parseRobots,
  parseSitemap,
  urlsFromLines,
  type SitemapUrl,
} from './site'


const URL_SAMPLE = `https://example.com/
https://example.com/about 2024-05-01
https://example.com/blog 2024-05-02`

type Mode = 'robots' | 'sitemap'

const tool: Tool = {
  slug: 'site-files',
  name: 'robots.txt & Sitemap Builder',
  description: 'Write and check robots.txt and sitemap.xml, with the usual crawl mistakes flagged.',
  category: 'Web',
  keywords: ['robots.txt', 'sitemap', 'seo', 'crawler', 'googlebot', 'indexing', 'xml', 'disallow'],
  render(root) {
    let mode: Mode = 'robots'
    const warnings = findings()
    let output = ''

    /* -------------------------------- robots -------------------------------- */
    const robotsAgent = textField({ value: '*', mono: true })
    const robotsDisallow = textarea({ rows: 5, mono: true, value: '/admin\n/private' })
    const robotsAllow = textarea({ rows: 3, mono: true, value: '/admin/public' })
    const robotsDelay = textField({ type: 'number', value: '', mono: true, placeholder: 'optional' })
    const robotsSitemap = textField({ value: 'https://example.com/sitemap.xml', mono: true })
    const robotsOut = outputBlock('', { label: 'robots.txt', copy: () => output })

    /* -------------------------------- sitemap ------------------------------- */
    const sitemapUrls = textarea({ rows: 8, mono: true, value: URL_SAMPLE })
    const sitemapPretty = textField({ type: 'number', value: '1', mono: true })
    const sitemapOut = outputBlock('', { label: 'sitemap.xml', copy: () => output })

    /* ------------------------------- validation ----------------------------- */
    const paste = textarea({ rows: 6, mono: true, placeholder: 'Paste an existing robots.txt or sitemap.xml to check…', onInput: () => validate() })
    const pasteError = note('', 'danger')
    pasteError.hidden = true

    function build() {
      pasteError.hidden = true
      if (mode === 'robots') {
        output = buildRobots({
          groups: [
            {
              userAgent: robotsAgent.value.trim() || '*',
              disallow: robotsDisallow.value.split(/\r\n?|\n/).map((line) => line.trim()).filter(Boolean),
              allow: robotsAllow.value.split(/\r\n?|\n/).map((line) => line.trim()).filter(Boolean),
              crawlDelay: robotsDelay.value.trim() ? Number(robotsDelay.value) : undefined,
            },
          ],
          sitemaps: robotsSitemap.value.trim() ? [robotsSitemap.value.trim()] : [],
        })
        robotsOut.body.replaceChildren(output)
        robotsOut.setMeta(`${output.split('\n').length} lines`)
        const check = parseRobots(output)
        warnings.replaceChildren(
          ...(check.warnings.length
            ? check.warnings.map((warning) => findingRow({ status: 'Check', tone: 'warn', name: 'Warning', message: warning }))
            : [findingRow({ status: 'OK', tone: 'ok', name: 'robots.txt', message: `${check.groups.length} group(s), ${check.sitemaps.length} sitemap link(s).` })]),
        )
      } else {
        const entries: SitemapUrl[] = urlsFromLines(sitemapUrls.value)
        output = buildSitemap(entries, { pretty: sitemapPretty.value !== '0' })
        sitemapOut.body.replaceChildren(output)
        sitemapOut.setMeta(`${entries.length} URLs`)
        const check = parseSitemap(output)
        warnings.replaceChildren(
          ...(check.warnings.length
            ? check.warnings.map((warning) => findingRow({ status: 'Check', tone: 'warn', name: 'Warning', message: warning }))
            : [findingRow({ status: 'OK', tone: 'ok', name: 'sitemap.xml', message: `${check.urls.length} valid URLs.` })]),
        )
      }
    }

    function validate() {
      const source = paste.value.trim()
      if (!source) {
        warnings.replaceChildren()
        pasteError.hidden = true
        return
      }
      pasteError.hidden = true
      try {
        if (/<\s*urlset/i.test(source) || source.startsWith('<?xml')) {
          const result = parseSitemap(source)
          warnings.replaceChildren(
            ...(result.warnings.length
              ? result.warnings.map((warning) => findingRow({ status: 'Check', tone: 'warn', name: 'Warning', message: warning }))
              : [findingRow({ status: 'OK', tone: 'ok', name: 'sitemap.xml', message: `${result.urls.length} URLs, no problems found.` })]),
          )
        } else {
          const result = parseRobots(source)
          const rows = result.groups.map((group) =>
            findingRow({
              status: group.userAgent.startsWith('*') ? 'All' : 'Named',
              tone: 'neutral',
              name: group.userAgent,
              message: `${group.disallow.length} disallow, ${group.allow.length} allow${group.crawlDelay ? `, delay ${group.crawlDelay}s` : ''}.`,
            }),
          )
          warnings.replaceChildren(
            ...result.warnings.map((warning) => findingRow({ status: 'Check', tone: 'warn', name: 'Warning', message: warning })),
            ...(rows.length ? rows : [note('No groups parsed.')]),
          )
        }
      } catch (err) {
        warnings.replaceChildren()
        pasteError.textContent = err instanceof Error ? err.message : 'Could not read that file.'
        pasteError.hidden = false
      }
    }

    const robotsPanel = panel(
      { title: 'robots.txt', icon: 'file' },
      grid(280, field(robotsAgent, { label: 'User-agent' }), field(robotsDelay, { label: 'Crawl-delay (seconds)' })),
      grid(280, field(robotsDisallow, { label: 'Disallow (one path per line)' }), field(robotsAllow, { label: 'Allow (one path per line)' })),
      field(robotsSitemap, { label: 'Sitemap URL' }),
      robotsOut,
    )

    const sitemapPanel = panel(
      { title: 'sitemap.xml', icon: 'file' },
      field(sitemapUrls, { label: 'URLs (one per line, optional YYYY-MM-DD date after)' }),
      field(sitemapPretty, { label: 'Pretty-print (1 yes, 0 no)' }),
      sitemapOut,
    )

    function show(next: Mode) {
      mode = next
      robotsPanel.hidden = next !== 'robots'
      sitemapPanel.hidden = next !== 'sitemap'
      build()
    }

    const modeControl = segmented({
      label: 'File',
      value: mode,
      items: [
        { value: 'robots', label: 'robots.txt' },
        { value: 'sitemap', label: 'sitemap.xml' },
      ],
      onChange: (value) => show(value as Mode),
    })

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Build', icon: 'sliders' },
          modeControl,
          actions(
            button('Load sample', {
              icon: 'refresh',
              onClick: () => {
                if (mode === 'robots') {
                  robotsAgent.value = '*'
                  robotsDisallow.value = '/admin\n/private'
                  robotsAllow.value = '/admin/public'
                  robotsSitemap.value = 'https://example.com/sitemap.xml'
                } else {
                  sitemapUrls.value = URL_SAMPLE
                }
                build()
              },
            }),
            copyButton(() => output, { label: 'Copy output' }),
            button('Download', {
              icon: 'download',
              onClick: () => download(mode === 'robots' ? 'robots.txt' : 'sitemap.xml', output, 'text/plain'),
            }),
          ),
          robotsPanel,
          sitemapPanel,
        ),
        panel({ title: 'Validate an existing file', icon: 'eye' }, paste, pasteError),
        panel({ title: 'Findings', icon: 'alert' }, warnings),
        note('A sitemap must use absolute https URLs. Users still need to serve robots.txt at the site root and point Search Console at the sitemap.'),
      ),
    )

    show('robots')
  },
}

export default tool
