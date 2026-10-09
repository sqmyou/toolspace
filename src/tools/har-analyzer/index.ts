import {
  actions,
  badge,
  button,
  card,
  cards,
  copyButton,
  download,
  findings,
  findingRow,
  note,
  panel,
  stat,
  stats,
  table,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { analyseHar, formatBytes, formatDuration, parseHar, type Group, type HarReport, type RequestRow } from './har'

const SAMPLE = JSON.stringify(
  {
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
            content: { size: 14200, mimeType: 'text/html; charset=utf-8' },
          },
        },
        {
          startedDateTime: '2024-01-01T10:00:00.050Z',
          time: 820,
          request: { method: 'GET', url: 'https://example.com/app.js?v=3' },
          response: {
            status: 200,
            headers: [{ name: 'content-encoding', value: 'br' }],
            content: { size: 204800, mimeType: 'text/javascript' },
          },
        },
        {
          startedDateTime: '2024-01-01T10:00:00.400Z',
          time: 60,
          request: { method: 'GET', url: 'https://cdn.example.com/logo.png' },
          response: { status: 304, content: { size: 0, mimeType: 'image/png' } },
        },
        {
          startedDateTime: '2024-01-01T10:00:00.900Z',
          time: 30,
          request: { method: 'GET', url: 'http://tracker.example.net/pixel.gif' },
          response: { status: 404, content: { size: -1, mimeType: 'image/gif' } },
        },
      ],
    },
  },
  null,
  2,
)

const tool: Tool = {
  slug: 'har-analyzer',
  name: 'HAR Analyzer',
  description: 'Summarise a browser HAR export: totals, slowest and heaviest requests, domains and errors.',
  category: 'Web',
  keywords: ['har', 'http archive', 'network', 'devtools', 'waterfall', 'performance', 'requests'],
  render(root) {
    const input = textarea({ rows: 14, value: SAMPLE, onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    const readout = stats()
    const headline = el('div', { class: 'ts-k-actions' })
    const groupings = cards()
    const slowSection = cards()
    const heavySection = cards()
    const issues = findings()
    const requests = el('div', { class: 'ts-k-tablewrap' })
    let reportText = ''

    function groupCard(group: Group): HTMLElement {
      return card(
        { title: group.label, meta: `${group.count} · ${formatBytes(group.bytes)}` },
      )
    }

    function rowsToTable(rows: RequestRow[]): HTMLElement {
      return table(
        [
          { key: 'method', label: 'Method' },
          { key: 'path', label: 'Path', mono: true },
          { key: 'status', label: 'Status' },
          { key: 'time', label: 'Time' },
          { key: 'size', label: 'Size' },
        ],
        rows.map((row) => ({
          method: row.method,
          path: row.path,
          status: row.error ? `${row.status} ${row.statusText}`.trim() : String(row.status),
          time: formatDuration(row.time),
          size: row.size ? formatBytes(row.size) : '—',
        })),
      )
    }

    function render(current: HarReport) {
      readout.replaceChildren(
        stat({ label: 'Requests', value: String(current.requestCount) }),
        stat({ label: 'Transferred', value: formatBytes(current.totalBytes) }),
        stat({
          label: 'On the wire',
          value: current.pageSpanMs === null ? '—' : formatDuration(current.pageSpanMs),
          hint: 'first to last request',
        }),
        stat({ label: 'Server time', value: formatDuration(current.totalTimeMs), hint: 'sum of durations' }),
      )

      headline.replaceChildren(
        el('span', { class: 'ts-k-card__title' }, `HAR ${current.version} · ${current.creator}`),
        badge(`${current.domains.length} domains`, 'neutral'),
        badge(`${current.cachedCount} cached`, 'neutral'),
        badge(`${current.redirects.length} redirects`, 'neutral'),
      )

      const groupCards = (title: string, groups: Group[]) =>
        card({ title, meta: String(groups.length) }, el('div', { class: 'ts-har-groups' }, ...groups.slice(0, 8).map(groupCard)))

      groupings.replaceChildren(
        groupCards('Domains', current.domains),
        groupCards('Types', current.types),
        groupCards('Statuses', current.statuses),
      )

      slowSection.replaceChildren(
        card({ title: 'Slowest requests' }, rowsToTable(current.slowest)),
      )
      heavySection.replaceChildren(
        card({ title: 'Heaviest responses' }, rowsToTable(current.heaviest)),
      )

      const notices: HTMLElement[] = []
      if (current.failures.length) {
        notices.push(
          ...current.failures
            .slice(0, 20)
            .map((row) =>
              findingRow({
                status: String(row.status || 'failed'),
                tone: 'danger',
                name: row.path,
                message: `${row.method} ${row.host}`,
              }),
            ),
        )
      }
      if (current.usesHttp.length) {
        notices.push(
          findingRow({
            status: 'Plain HTTP',
            tone: 'warn',
            name: `${current.usesHttp.length} request${current.usesHttp.length === 1 ? '' : 's'} over http://`,
            message: 'Traffic is unencrypted. Prefer https://.',
          }),
        )
      }
      if (current.hasQueryStrings) {
        notices.push(
          findingRow({
            status: 'Query',
            tone: 'neutral',
            name: `${current.hasQueryStrings} URL${current.hasQueryStrings === 1 ? '' : 's'} carry a query string`,
            message: 'Check nothing sensitive is in a query parameter.',
          }),
        )
      }
      issues.replaceChildren(...(notices.length ? notices : [note('No failed requests or plain-HTTP traffic found.', 'ok')]))

      requests.replaceChildren(rowsToTable(current.entries))

      reportText = [
        `HAR ${current.version} from ${current.creator}`,
        `requests: ${current.requestCount}`,
        `transferred: ${formatBytes(current.totalBytes)}`,
        `page span: ${current.pageSpanMs === null ? 'unknown' : formatDuration(current.pageSpanMs)}`,
        `server time: ${formatDuration(current.totalTimeMs)}`,
        '',
        'By domain:',
        ...current.domains.map((group) => `- ${group.label}: ${group.count} requests, ${formatBytes(group.bytes)}`),
        '',
        'Slowest:',
        ...current.slowest.slice(0, 5).map((row) => `- ${formatDuration(row.time)} ${row.method} ${row.path}`),
      ].join('\n')
    }

    function clear() {
      readout.replaceChildren()
      headline.replaceChildren()
      groupings.replaceChildren()
      slowSection.replaceChildren()
      heavySection.replaceChildren()
      issues.replaceChildren()
      requests.replaceChildren()
      reportText = ''
    }

    function run() {
      error.hidden = true
      if (!input.value.trim()) {
        clear()
        return
      }
      try {
        render(analyseHar(parseHar(input.value)))
      } catch (err) {
        clear()
        error.textContent = err instanceof Error ? err.message : 'Could not read that HAR file.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'HAR file', icon: 'file' },
          input,
          actions(
            button('Load sample', { icon: 'refresh', onClick: () => { input.value = SAMPLE; run() } }),
            button('Clear', { icon: 'x', onClick: () => { input.value = ''; run() } }),
          ),
          error,
        ),
        panel({ title: 'Summary', icon: 'chart' }, readout, headline),
        panel({ title: 'Breakdown', icon: 'grid' }, groupings),
        panel({ title: 'Rankings', icon: 'sort' }, slowSection, heavySection),
        panel({ title: 'Notable', icon: 'alert' }, issues),
        panel({ title: 'All requests', icon: 'list' }, requests),
        actions(
          copyButton(() => reportText, { label: 'Copy summary' }),
          button('Download summary', {
            icon: 'download',
            onClick: () => download('har-summary.txt', reportText, 'text/plain'),
          }),
        ),
        note('HAR files can contain cookies and auth headers. Nothing is parsed away from this page, but review before sharing a summary.'),
      ),
    )

    run()
  },
}

export default tool
