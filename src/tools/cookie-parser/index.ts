import {
  actions,
  badge,
  card,
  cards,
  chips,
  copyButton,
  findings,
  findingRow,
  note,
  outputBlock,
  panel,
  textarea,
  toolLayout,
  type Tone,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { CookieError, formatAttributes, parseCookieHeader, parseSetCookieBlock, serialise, type ParsedCookie } from './cookie'

const LEVEL_TONES: Record<string, Tone> = { error: 'danger', warn: 'warn', info: 'neutral' }

const tool: Tool = {
  slug: 'cookie-parser',
  name: 'Cookie Parser & Security Audit',
  description: 'Parse Set-Cookie and Cookie headers and check the security flags on each cookie.',
  category: 'Security',
  keywords: ['cookie', 'set-cookie', 'http', 'secure', 'httponly', 'samesite', 'audit', 'header'],
  render(root) {
    const input = textarea({
      rows: 8,
      mono: true,
      placeholder: 'session=abc; Domain=example.com; Path=/; SameSite=Lax; Secure; HttpOnly',
      onInput: () => run(),
    })
    const error = note('', 'danger')
    error.hidden = true
    const summary = badge('—')
    const output = cards()
    let report = ''
    const reportBlock = outputBlock('', { label: 'Audit report', copy: () => report })

    function renderCookie(cookie: ParsedCookie): HTMLElement {
      return card(
        { title: cookie.name, meta: cookie.expired ? 'expired' : 'active', metaTone: cookie.expired ? 'warn' : 'ok' },
        chips(formatAttributes(cookie).map((line) => ({ label: line, onClick: () => {} }))),
        findings(
          ...(cookie.issues.length
            ? cookie.issues.map((issue) => findingRow({ status: issue.level, tone: LEVEL_TONES[issue.level] ?? 'neutral', name: cookie.name, message: issue.message }))
            : [findingRow({ status: 'ok', tone: 'ok', name: cookie.name, message: 'No issues found.' })]),
        ),
        actions(copyButton(() => serialise(cookie), { label: 'Copy normalised', size: 'sm' })),
      )
    }

    function run() {
      output.replaceChildren()
      report = ''
      reportBlock.body.replaceChildren('')
      reportBlock.setMeta('')
      const text = input.value.trim()
      if (!text) {
        error.hidden = true
        summary.textContent = '—'
        return
      }
      try {
        const firstLine = text.split('\n')[0]
        const hasAttribute = /\b(secure|httponly|samesite|domain|path|max-age|expires|partitioned)\b/i.test(firstLine)
        const cookies =
          hasAttribute || text.includes('\n')
            ? parseSetCookieBlock(text)
            : (() => {
                // A single line with no flags is a Cookie request header, which
                // carries names and values only.
                const pairs = parseCookieHeader(text)
                summary.textContent = `${pairs.length} request cookie${pairs.length === 1 ? '' : 's'}`
                return parseSetCookieBlock(pairs.map((pair) => `${pair.name}=${pair.value}`).join('\n'))
              })()
        if (hasAttribute || text.includes('\n')) {
          summary.textContent = `${cookies.length} Set-Cookie line${cookies.length === 1 ? '' : 's'}`
        }
        for (const cookie of cookies) output.append(renderCookie(cookie))
        report = cookies
          .map((cookie) => `${cookie.name}: ${cookie.issues.length ? cookie.issues.map((i) => `${i.level}: ${i.message}`).join(' | ') : 'ok'}`)
          .join('\n')
        reportBlock.body.replaceChildren(report)
        reportBlock.setMeta('')
        error.hidden = true
      } catch (err) {
        error.textContent = err instanceof CookieError ? err.message : 'Could not parse that cookie.'
        error.hidden = false
        summary.textContent = '—'
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Cookie header', icon: 'code' },
          input,
          error,
          note('Request headers carry names and values only — flags appear on Set-Cookie lines.'),
        ),
        panel({ title: 'Cookies', icon: 'shield' }, actions(summary), output),
        reportBlock,
        note('Paste Set-Cookie lines (one per line) or a Cookie request header. Nothing is sent anywhere.'),
      ),
    )

    run()
  },
}

export default tool
