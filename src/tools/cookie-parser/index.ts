import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { CookieError, formatAttributes, parseCookieHeader, parseSetCookieBlock, serialise, type ParsedCookie } from './cookie'

const tool: Tool = {
  slug: 'cookie-parser',
  name: 'Cookie Parser & Security Audit',
  description: 'Parse Set-Cookie and Cookie headers and check the security flags on each cookie.',
  category: 'Security',
  keywords: ['cookie', 'set-cookie', 'http', 'secure', 'httponly', 'samesite', 'audit', 'header'],
  render(root) {
    const input = el('textarea', {
      class: 'ts-textarea ts-mono',
      rows: 8,
      spellcheck: false,
      placeholder: 'session=abc; Domain=example.com; Path=/; SameSite=Lax; Secure; HttpOnly',
    }) as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const summary = el('p', { class: 'ts-muted' })
    const output = el('div', { class: 'ts-cookie-list' })
    let report = ''

    function renderCookie(cookie: ParsedCookie): HTMLElement {
      const card = el('div', { class: 'ts-cookie-card' })
      card.append(
        el('div', { class: 'ts-cookie-head' }, el('code', { class: 'ts-cookie-name' }, cookie.name), el('span', { class: 'ts-muted' }, cookie.expired ? 'expired' : 'active')),
      )
      const attributes = el('div', { class: 'ts-cookie-attrs' })
      for (const line of formatAttributes(cookie)) attributes.append(el('span', { class: 'ts-cookie-attr' }, line))
      card.append(attributes)

      if (cookie.issues.length) {
        const issues = el('div', { class: 'ts-cookie-issues' })
        for (const issue of cookie.issues) {
          issues.append(el('p', { class: `ts-issue ts-issue-${issue.level}` }, `${issue.level.toUpperCase()}: ${issue.message}`))
        }
        card.append(issues)
      } else {
        card.append(el('p', { class: 'ts-issue ts-issue-ok' }, 'No issues found.'))
      }
      card.append(el('div', { class: 'ts-row ts-between' }, el('span', { class: 'ts-muted' }, 'Normalised'), copyChip(serialise(cookie))))
      return card
    }

    function run() {
      output.replaceChildren()
      report = ''
      const text = input.value.trim()
      if (!text) {
        error.hidden = true
        summary.textContent = ''
        return
      }
      try {
        const firstLine = text.split('\n')[0]
        const hasAttribute = /\b(secure|httponly|samesite|domain|path|max-age|expires|partitioned)\b/i.test(firstLine)
        const cookies = hasAttribute || text.includes('\n')
          ? parseSetCookieBlock(text)
          : (() => {
              // A single line with no flags is a Cookie request header, which
              // carries names and values only.
              const pairs = parseCookieHeader(text)
              summary.textContent = `${pairs.length} request cookie${pairs.length === 1 ? '' : 's'} (names and values only — request headers carry no flags)`
              return parseSetCookieBlock(pairs.map((pair) => `${pair.name}=${pair.value}`).join('\n'))
            })()
        if (hasAttribute || text.includes('\n')) {
          summary.textContent = `${cookies.length} Set-Cookie line${cookies.length === 1 ? '' : 's'}`
        }
        for (const cookie of cookies) output.append(renderCookie(cookie))
        report = cookies
          .map((cookie) => `${cookie.name}: ${cookie.issues.length ? cookie.issues.map((i) => `${i.level}: ${i.message}`).join(' | ') : 'ok'}`)
          .join('\n')
        error.hidden = true
      } catch (err) {
        error.textContent = err instanceof CookieError ? err.message : 'Could not parse that cookie.'
        error.hidden = false
        summary.textContent = ''
      }
    }

    input.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Cookie header'), input),
        error,
        el('div', { class: 'ts-row ts-between' }, summary, copyChip(() => report, 'Copy report')),
        output,
        el('p', { class: 'ts-note' }, 'Paste Set-Cookie lines (one per line) or a Cookie request header. Nothing is sent anywhere.'),
      ),
    )

    run()
  },
}

export default tool
