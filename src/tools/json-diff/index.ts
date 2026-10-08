import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { diffJson, renderValue, summarize } from './diff'

const tool: Tool = {
  slug: 'json-diff',
  name: 'JSON Diff',
  description: 'Compare two JSON documents node by node, ignoring key order.',
  category: 'Data',
  keywords: ['json', 'diff', 'compare', 'changes', 'patch', 'structural'],
  render(root) {
    const left = el('textarea', { class: 'ts-textarea ts-mono', rows: 10, spellcheck: false, placeholder: 'First JSON…' }) as HTMLTextAreaElement
    const right = el('textarea', { class: 'ts-textarea ts-mono', rows: 10, spellcheck: false, placeholder: 'Second JSON…' }) as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const summary = el('p', { class: 'ts-muted' })
    const list = el('div', { class: 'ts-diff-list' })

    function run() {
      list.replaceChildren()
      const a = left.value.trim()
      const b = right.value.trim()
      if (!a && !b) {
        error.hidden = true
        summary.textContent = ''
        return
      }
      let parsedA: unknown
      let parsedB: unknown
      try {
        parsedA = JSON.parse(a || 'null')
        parsedB = JSON.parse(b || 'null')
      } catch (err) {
        error.textContent = `Invalid JSON — ${err instanceof Error ? err.message : 'could not parse input.'}`
        error.hidden = false
        summary.textContent = ''
        return
      }
      error.hidden = true
      const changes = diffJson(parsedA, parsedB)
      const counts = summarize(changes)
      summary.textContent = `${changes.length} change${changes.length === 1 ? '' : 's'} · +${counts.added} −${counts.removed} ~${counts.changed} type ${counts.type}`

      if (changes.length === 0) {
        list.append(el('p', { class: 'ts-empty' }, 'The two documents are structurally identical.'))
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

    left.addEventListener('input', run)
    right.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-field ts-grow' }, el('label', {}, 'Before'), left),
          el('div', { class: 'ts-field ts-grow' }, el('label', {}, 'After'), right),
        ),
        error,
        summary,
        list,
        el('p', { class: 'ts-note' }, 'Key order is ignored. Arrays are compared by position. Nothing is uploaded.'),
      ),
    )

    run()
  },
}

export default tool
