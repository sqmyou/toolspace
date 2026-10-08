import {
  actions,
  badge,
  copyRow,
  field,
  kvList,
  note,
  panel,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { compareVersions, describeRange, isStable, nextVersions, parse, satisfies, SemverError } from './semver'

const tool: Tool = {
  slug: 'semver-checker',
  name: 'Semver Checker',
  description: 'Compare versions, test ranges and see the next major, minor and patch bumps.',
  category: 'Code',
  keywords: ['semver', 'semantic', 'version', 'range', 'caret', 'tilde', 'compare', 'npm'],
  render(root) {
    const versionA = textField({ value: '1.2.3', mono: true, onInput: () => run() })
    const versionB = textField({ value: '1.5.0', mono: true, onInput: () => run() })
    const rangeInput = textField({ value: '^1.2.0', mono: true, onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    const verdict = el('div', { class: 'ts-k-chips' })
    const info = el('p', { class: 'ts-k-hint' })
    const bumps = kvList()

    function run() {
      bumps.replaceChildren()
      verdict.replaceChildren()
      try {
        const a = parse(versionA.value)
        error.hidden = true

        const diff = compareVersions(versionA.value, versionB.value)
        const relation = diff === 0 ? 'equal to' : diff < 0 ? 'older than' : 'newer than'
        const matches = satisfies(versionA.value, rangeInput.value)
        verdict.replaceChildren(
          badge(`${versionA.value} ${relation} ${versionB.value}`),
          badge(isStable(a) ? 'stable' : 'prerelease', isStable(a) ? 'ok' : 'warn'),
          badge(matches ? 'satisfies range' : 'outside range', matches ? 'ok' : 'danger'),
        )
        info.textContent = describeRange(rangeInput.value)

        bumps.replaceChildren(...nextVersions(a).map((bump) => copyRow(bump.label, bump.version)))
      } catch (err) {
        error.textContent = err instanceof SemverError ? err.message : 'Enter versions like 1.2.3 and a range like ^1.2.0.'
        error.hidden = false
        info.textContent = ''
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Versions', icon: 'hash' },
          actions(
            field(versionA, { label: 'Version A', grow: true }),
            field(versionB, { label: 'Version B', grow: true }),
            field(rangeInput, { label: 'Range', grow: true }),
          ),
          error,
        ),
        panel({ title: 'Comparison', icon: 'check' }, verdict, info),
        panel({ title: 'Next versions', icon: 'arrowUp' }, bumps),
        note('Supports exact versions, comparators, ^, ~, wildcards, hyphen ranges and || unions.'),
      ),
    )

    run()
  },
}

export default tool
