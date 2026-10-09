import {
  actions,
  button,
  copyButton,
  findings,
  findingRow,
  note,
  panel,
  stats,
  stat,
  textarea,
  toolLayout,
} from '../../core/components'

import type { Tool } from '../../core/types'
import { changelogSection, formatCommit, lintCommit, type CommitReport } from './commit'

const SAMPLE = `feat(tools): add har analyzer

Reads a devtools HAR export and ranks the slowest and heaviest requests.

Refs: #128`

const tool: Tool = {
  slug: 'commit-lint',
  name: 'Conventional Commit Linter',
  description: 'Check a commit message against Conventional Commits and see what a changelog would call it.',
  category: 'Code',
  keywords: ['git', 'commit', 'conventional commits', 'changelog', 'lint', 'semantic', 'message'],
  render(root) {
    const input = textarea({ rows: 8, mono: true, value: SAMPLE, onInput: () => run() })
    const headline = stats()
    const breakdown = note('', 'accent')
    breakdown.hidden = true
    const list = findings()
    const normalised = note('', 'neutral')
    normalised.hidden = true
    let formatted = ''

    function render(report: CommitReport) {
      headline.replaceChildren(
        stat({ label: 'Result', value: report.valid ? 'Valid' : 'Invalid', hint: report.valid ? 'matches the spec' : 'fix the errors' }),
        stat({ label: 'Type', value: report.parts?.type ?? '—' }),
        stat({ label: 'Scope', value: report.parts?.scope ?? '—' }),
        stat({ label: 'Breaking', value: report.parts?.breaking ? 'Yes' : 'No' }),
        stat({ label: 'Findings', value: String(report.findings.length) }),
      )

      if (report.parts) {
        const section = changelogSection(report.parts.type)
        breakdown.textContent = report.parts.breaking
          ? `${section} · released as a breaking change`
          : `Changelog section: ${section}`
        breakdown.hidden = false
        formatted = formatCommit(report.parts)
        normalised.textContent = report.parts.scope ? `Scope "${report.parts.scope}", ${report.parts.footers.length} footer(s).` : `${report.parts.footers.length} footer(s).`
        normalised.hidden = false
      } else {
        breakdown.hidden = true
        formatted = ''
        normalised.hidden = true
      }

      list.replaceChildren(
        ...(report.findings.length
          ? report.findings.map((finding) =>
              findingRow({
                status: finding.severity === 'error' ? 'Error' : 'Warn',
                tone: finding.severity === 'error' ? 'danger' : 'warn',
                name: finding.severity === 'error' ? 'Blocking' : 'Suggestion',
                message: finding.message,
              }),
            )
          : [note('No problems found. This message follows the spec.', 'ok')]),
      )
    }

    function run() {
      if (!input.value.trim()) {
        headline.replaceChildren()
        list.replaceChildren()
        breakdown.hidden = true
        normalised.hidden = true
        formatted = ''
        return
      }
      render(lintCommit(input.value))
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Commit message', icon: 'text' },
          input,
          actions(
            button('Load sample', { icon: 'refresh', onClick: () => { input.value = SAMPLE; run() } }),
            copyButton(() => formatted, { label: 'Copy normalised' }),
          ),
        ),
        panel({ title: 'Verdict', icon: 'check' }, headline, breakdown, normalised),
        panel({ title: 'Findings', icon: 'alert' }, list),
        note('Errors block the commit; suggestions are style. The types recognised are feat, fix, docs, style, refactor, perf, test, build, ci, chore and revert.'),
      ),
    )

    run()
  },
}

export default tool
