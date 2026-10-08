import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { compareVersions, describeRange, isStable, nextVersions, parse, satisfies, SemverError } from './semver'

const tool: Tool = {
  slug: 'semver-checker',
  name: 'Semver Checker',
  description: 'Compare versions, test ranges and see the next major, minor and patch bumps.',
  category: 'Code',
  keywords: ['semver', 'semantic', 'version', 'range', 'caret', 'tilde', 'compare', 'npm'],
  render(root) {
    const versionA = el('input', { class: 'ts-input ts-mono', type: 'text', value: '1.2.3', spellcheck: false, 'aria-label': 'Version A' }) as HTMLInputElement
    const versionB = el('input', { class: 'ts-input ts-mono', type: 'text', value: '1.5.0', spellcheck: false, 'aria-label': 'Version B' }) as HTMLInputElement
    const rangeInput = el('input', { class: 'ts-input ts-mono', type: 'text', value: '^1.2.0', spellcheck: false, 'aria-label': 'Range' }) as HTMLInputElement
    const info = el('div', { class: 'ts-semver-info' })
    const bumpRow = el('div', { class: 'ts-copy-list' })
    const error = el('p', { class: 'ts-error', hidden: true })
    let matchLine = ''

    function run() {
      info.replaceChildren()
      bumpRow.replaceChildren()
      try {
        const a = parse(versionA.value)
        error.hidden = true

        const diff = compareVersions(versionA.value, versionB.value)
        const relation = diff === 0 ? 'equal to' : diff < 0 ? 'older than' : 'newer than'
        const stable = isStable(a) ? 'stable' : 'prerelease'
        info.append(
          el('p', { class: 'ts-muted' }, `${versionA.value} is ${relation} ${versionB.value}. Version A is a ${stable} release.`),
        )

        for (const bump of nextVersions(a)) {
          bumpRow.append(el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, bump.label), copyChip(bump.version)))
        }

        const matches = satisfies(versionA.value, rangeInput.value)
        matchLine = `${versionA.value} ${matches ? 'satisfies' : 'does not satisfy'} ${rangeInput.value}`
        info.append(
          el('p', { class: matches ? 'ts-ok' : 'ts-bad' }, matchLine),
          el('p', { class: 'ts-muted' }, describeRange(rangeInput.value)),
        )
      } catch (err) {
        error.textContent = err instanceof SemverError ? err.message : 'Enter versions like 1.2.3 and a range like ^1.2.0.'
        error.hidden = false
      }
    }

    for (const input of [versionA, versionB, rangeInput]) input.addEventListener('input', run)

    const field = (label: string, input: HTMLElement) => el('div', { class: 'ts-inline-field' }, el('label', {}, label), input)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          field('Version A', versionA),
          field('Version B', versionB),
          field('Range', rangeInput),
        ),
        error,
        info,
        el('h3', { class: 'ts-subhead' }, 'Next versions'),
        bumpRow,
        el('p', { class: 'ts-note' }, 'Supports exact versions, comparators, ^, ~, wildcards, hyphen ranges and || unions.'),
      ),
    )

    run()
  },
}

export default tool
