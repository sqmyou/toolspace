import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { explain, generate, isIgnored, summarise, TEMPLATES, templateNames } from './gitignore'

const tool: Tool = {
  slug: 'gitignore',
  name: '.gitignore Builder',
  description: 'Compose a .gitignore from templates and test paths against your patterns.',
  category: 'Web',
  keywords: ['gitignore', 'git', 'ignore', 'patterns', 'glob', 'template', 'node_modules'],
  render(root) {
    const chosen = new Set<string>(['Node'])
    const content = el('textarea', { class: 'ts-textarea ts-mono', rows: 12, spellcheck: false }) as HTMLTextAreaElement
    const testPath = el('input', { class: 'ts-input ts-mono', value: 'node_modules/react/index.js' }) as HTMLInputElement
    const decision = el('div', { class: 'ts-git-decision' })
    const stats = el('p', { class: 'ts-muted' })

    const templateButtons = templateNames().map((name) =>
      el('button', { class: `ts-chip${chosen.has(name) ? ' ts-chip-active' : ''}`, type: 'button', onclick: () => { chosen.has(name) ? chosen.delete(name) : chosen.add(name); refreshTemplates() } }, name),
    )

    function refreshTemplates() {
      for (const [index, button] of templateButtons.entries()) button.classList.toggle('ts-chip-active', chosen.has(templateNames()[index]))
      const text = generate([...chosen])
      content.value = text || (content.value.trim() ? content.value : '')
      run()
    }

    function run() {
      const patterns = content.value.split(/\r?\n/)
      const summary = summarise(patterns)
      stats.textContent = `${summary.total} patterns · ${summary.negations} negations · ${summary.directoryOnly} directory-only · ${summary.anchored} anchored`

      decision.replaceChildren()
      const path = testPath.value.trim()
      if (!path) return
      const result = explain(patterns, path)
      const ignored = isIgnored(patterns, path)
      decision.append(
        el('span', { class: `ts-git-verdict ${ignored ? 'ts-git-ignored' : 'ts-git-kept'}` }, ignored ? 'Ignored' : 'Not ignored'),
        el('code', { class: 'ts-git-path' }, path),
        result.matched ? el('span', { class: 'ts-muted' }, `matched ${result.matched}`) : el('span', { class: 'ts-muted' }, 'no pattern matched'),
      )
    }

    content.addEventListener('input', run)
    testPath.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('h3', { class: 'ts-subhead' }, 'Templates'),
        el('div', { class: 'ts-row ts-wrap' }, ...templateButtons),
        el('div', { class: 'ts-field' }, el('label', {}, '.gitignore'), content),
        el('div', { class: 'ts-row ts-between' }, stats, copyChip(() => content.value, 'Copy file')),
        el('h3', { class: 'ts-subhead' }, 'Test a path'),
        testPath,
        decision,
        el('p', { class: 'ts-note' }, `Rules follow git: a pattern without a slash matches at any depth, one with a slash is anchored, a trailing slash means directories, and a leading ! re-includes. ${Object.keys(TEMPLATES).length} templates are built in.`),
      ),
    )

    refreshTemplates()
  },
}

export default tool
