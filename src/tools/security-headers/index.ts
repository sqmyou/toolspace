import {
  actions,
  badge,
  checkbox,
  copyButton,
  field,
  findings,
  findingRow,
  note,
  panel,
  textarea,
  toolLayout,
  type Tone,
} from '../../core/components'
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
const STATUS_TONES: Record<Finding['status'], Tone> = { good: 'ok', weak: 'warn', missing: 'neutral', leaking: 'accent' }

const tool: Tool = {
  slug: 'security-headers',
  name: 'Security Headers Checker',
  description: 'Review pasted response headers for missing or weak security settings.',
  category: 'Security',
  keywords: ['security', 'headers', 'csp', 'hsts', 'curl', 'http', 'hardening', 'frame options'],
  render(root) {
    const input = textarea({ rows: 12, mono: true, value: SAMPLE, onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    const score = badge('—')
    const summary = note('')
    const list = findings()
    let onlyProblems = false

    function run() {
      error.hidden = true
      try {
        const report = analyse(input.value)
        score.textContent = `${report.score}%`
        score.className = `ts-k-badge ts-k-badge--${report.score >= 80 ? 'ok' : report.score >= 50 ? 'warn' : 'danger'}`
        summary.textContent = `${report.missing.length} missing · ${report.weak.length} weak · ${report.leaks.length} leaking. ${
          report.missing.length === 0 && report.weak.length === 0
            ? 'Every header this tool looks for is set to a strong value.'
            : 'Work through the missing and weak entries below.'
        }`

        list.replaceChildren(
          ...report.findings
            .filter((finding) => !onlyProblems || finding.status !== 'good')
            .map((finding) =>
              findingRow({
                status: STATUS_LABELS[finding.status],
                tone: STATUS_TONES[finding.status],
                name: finding.name,
                message: finding.message,
                action: finding.value !== null ? copyButton(finding.value, { label: 'Copy value', size: 'sm' }) : undefined,
              }),
            ),
        )
      } catch (err) {
        list.replaceChildren()
        error.textContent = err instanceof Error ? err.message : 'Could not read those headers.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Response headers', icon: 'globe' },
          field(input, { label: 'Response headers' }),
          actions(
            checkbox({
              label: 'Show only missing and weak',
              onChange: (checked) => {
                onlyProblems = checked
                run()
              },
            }),
          ),
          error,
        ),
        panel({ title: 'Report', icon: 'shield' }, actions(score, summary), list),
        note(`${HEADERS.length} headers are checked, weighted by how much they matter. A present but permissive value counts as weak, not as a pass.`),
      ),
    )

    run()
  },
}

export default tool
