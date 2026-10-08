import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { analyse, HEADERS, type Finding } from './headers'

const SAMPLE = `HTTP/2 200
content-type: text/html; charset=utf-8
strict-transport-security: max-age=63072000; includeSubDomains
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline'
x-content-type-options: nosniff
x-frame-options: SAMEORIGIN
referrer-policy: strict-origin-when-cross-origin
server: nginx/1.25.3`

const STATUS_LABELS: Record<Finding['status'], string> = { good: 'Good', weak: 'Weak', missing: 'Missing', leaking: 'Leaks' }

const tool: Tool = {
  slug: 'security-headers',
  name: 'Security Headers Checker',
  description: 'Review pasted response headers for missing or weak security settings.',
  category: 'Security',
  keywords: ['security', 'headers', 'csp', 'hsts', 'curl', 'http', 'hardening', 'frame options'],
  render(root) {
    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 12, spellcheck: false }, SAMPLE) as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const score = el('div', { class: 'ts-headers-score' })
    const list = el('div', { class: 'ts-headers-list' })
    const summary = el('p', { class: 'ts-muted' })
    let onlyProblems = false

    function run() {
      error.hidden = true
      score.replaceChildren()
      list.replaceChildren()
      try {
        const report = analyse(input.value)
        score.append(
          el('span', { class: `ts-headers-grade ts-headers-${report.score >= 80 ? 'good' : report.score >= 50 ? 'weak' : 'bad'}` }, `${report.score}%`),
          el('span', { class: 'ts-muted' }, `${report.missing.length} missing · ${report.weak.length} weak · ${report.leaks.length} leaking`),
        )
        summary.textContent = report.missing.length === 0 && report.weak.length === 0 ? 'Every header this tool looks for is set to a strong value.' : 'Work through the missing and weak entries below.'

        for (const finding of report.findings) {
          if (onlyProblems && finding.status === 'good') continue
          const row = el(
            'div',
            { class: `ts-headers-row ts-headers-${finding.status}` },
            el('span', { class: `ts-headers-status ts-headers-status-${finding.status}` }, STATUS_LABELS[finding.status]),
            el('div', { class: 'ts-headers-body' }, el('code', { class: 'ts-headers-name' }, finding.name), el('span', { class: 'ts-headers-message' }, finding.message)),
          )
          if (finding.value !== null) row.append(copyChip(finding.value, 'Copy value'))
          list.append(row)
        }
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not read those headers.'
        error.hidden = false
      }
    }

    input.addEventListener('input', run)
    const problems = el('input', { type: 'checkbox' }) as HTMLInputElement
    problems.addEventListener('change', () => { onlyProblems = problems.checked; run() })

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('p', { class: 'ts-note' }, 'Paste the output of curl -I or your proxy logs. Nothing is sent anywhere.'),
        el('div', { class: 'ts-field' }, el('label', {}, 'Response headers'), input),
        error,
        score,
        summary,
        el('label', { class: 'ts-inline-field' }, problems, 'Show only missing and weak'),
        list,
        el('p', { class: 'ts-note' }, `${HEADERS.length} headers are checked, weighted by how much they matter. A present but permissive value counts as weak, not as a pass.`),
      ),
    )

    run()
  },
}

export default tool
