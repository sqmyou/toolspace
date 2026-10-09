import {
  badge,
  field,
  grid,
  note,
  panel,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { diffJson, renderValue, summarize } from './diff'

const BEFORE = `{
  "name": "toolspace",
  "private": true,
  "tools": 91,
  "tags": ["privacy", "browser"]
}`

const AFTER = `{
  "name": "toolspace",
  "private": true,
  "tools": 92,
  "tags": ["privacy", "offline"],
  "stars": 12
}`

const tool: Tool = {
  slug: 'json-diff',
  name: 'JSON Diff',
  description: 'Compare two JSON documents node by node, ignoring key order.',
  category: 'Data',
  keywords: ['json', 'diff', 'compare', 'changes', 'patch', 'structural'],
  render(root) {
    const left = textarea({ rows: 12, mono: true, value: BEFORE, onInput: () => run() })
    const right = textarea({ rows: 12, mono: true, value: AFTER, onInput: () => run() })
    const summary = el('div', { class: 'ts-json-diff-summary' })
    const list = el('div', { class: 'ts-diff-list' })

    function run() {
      list.replaceChildren()
      const a = left.value.trim()
      const b = right.value.trim()
      if (!a && !b) {
        summary.replaceChildren()
        return
      }
      let parsedA: unknown
      let parsedB: unknown
      try {
        parsedA = JSON.parse(a || 'null')
        parsedB = JSON.parse(b || 'null')
      } catch (err) {
        summary.replaceChildren(badge(`Invalid JSON — ${err instanceof Error ? err.message : 'could not parse input.'}`, 'danger'))
        return
      }
      const changes = diffJson(parsedA, parsedB)
      const counts = summarize(changes)
      summary.replaceChildren(
        badge(`${changes.length} change${changes.length === 1 ? '' : 's'}`, changes.length ? 'accent' : 'ok'),
        badge(`+${counts.added}`, 'ok'),
        badge(`−${counts.removed}`, 'danger'),
        badge(`~${counts.changed}`, 'warn'),
        badge(`${counts.type} type`, 'warn'),
      )

      if (changes.length === 0) {
        list.append(el('p', { class: 'ts-k-note ts-k-note--ok' }, 'The two documents are structurally identical.'))
        return
      }
      for (const change of changes) {
        const row = el('div', { class: `ts-diff-row ts-diff-${change.kind}` })
        row.append(el('span', { class: 'ts-diff-kind' }, change.kind))
        row.append(el('code', { class: 'ts-diff-path' }, change.path))
        if (change.kind !== 'added') row.append(el('span', { class: 'ts-diff-before' }, renderValue(change.before)))
        if (change.kind !== 'removed') row.append(el('span', { class: 'ts-diff-after' }, renderValue(change.after)))
        list.append(row)
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Documents', icon: 'braces' },
          grid(
            280,
            field(left, { label: 'Before' }),
            field(right, { label: 'After' }),
          ),
        ),
        panel({ title: 'Changes', icon: 'braces' }, summary, list),
        note('Key order is ignored. Arrays are compared by position.'),
      ),
    )

    run()
  },
}

export default tool
