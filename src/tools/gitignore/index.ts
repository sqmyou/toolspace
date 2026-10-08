import {
  actions,
  badge,
  chips,
  copyButton,
  field,
  note,
  panel,
  stat,
  stats,
  textField,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { explain, generate, isIgnored, summarise, TEMPLATES, templateNames } from './gitignore'

const NAMES = templateNames()

const tool: Tool = {
  slug: 'gitignore',
  name: '.gitignore Builder',
  description: 'Compose a .gitignore from templates and test paths against your patterns.',
  category: 'Web',
  keywords: ['gitignore', 'git', 'ignore', 'patterns', 'glob', 'template', 'node_modules'],
  render(root) {
    const chosen = new Set<string>(['Node'])
    const content = textarea({ rows: 12, onInput: () => run() })
    const testPath = textField({ value: 'node_modules/react/index.js', mono: true, onInput: () => run() })
    const decision = el('div', { class: 'ts-git-decision' })
    const summary = stats()

    const templateChips = chips(
      NAMES.map((name) => ({
        label: name,
        active: chosen.has(name),
        onClick: (value) => {
          if (chosen.has(value)) chosen.delete(value)
          else chosen.add(value)
          refreshTemplates()
        },
      })),
      { multi: true },
    )

    function refreshTemplates() {
      const text = generate([...chosen])
      content.value = text || (content.value.trim() ? content.value : '')
      run()
    }

    function run() {
      const patterns = content.value.split(/\r?\n/)
      const counts = summarise(patterns)
      summary.replaceChildren(
        stat({ label: 'Patterns', value: String(counts.total) }),
        stat({ label: 'Negations', value: String(counts.negations) }),
        stat({ label: 'Directory only', value: String(counts.directoryOnly) }),
        stat({ label: 'Anchored', value: String(counts.anchored) }),
      )

      decision.replaceChildren()
      const path = testPath.value.trim()
      if (!path) return
      const result = explain(patterns, path)
      const ignored = isIgnored(patterns, path)
      decision.append(
        badge(ignored ? 'Ignored' : 'Not ignored', ignored ? 'danger' : 'ok'),
        el('code', { class: 'ts-git-path' }, path),
        el('span', { class: 'ts-k-hint' }, result.matched ? `matched ${result.matched}` : 'no pattern matched'),
      )
    }

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'Templates', icon: 'layers' }, templateChips),
        panel(
          { title: '.gitignore', icon: 'file', meta: 'editable' },
          field(content, { label: 'Contents' }),
          summary,
          actions(copyButton(() => content.value, { label: 'Copy file' })),
        ),
        panel({ title: 'Test a path', icon: 'search' }, field(testPath, { label: 'Path' }), decision),
        note(`Rules follow git: a pattern without a slash matches at any depth, one with a slash is anchored, a trailing slash means directories, and a leading ! re-includes. ${Object.keys(TEMPLATES).length} templates are built in.`),
      ),
    )

    refreshTemplates()
  },
}

export default tool
