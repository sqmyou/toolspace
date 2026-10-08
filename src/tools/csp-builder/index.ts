import { el } from '../../core/dom'
import { copyChip, download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { KNOWN_DIRECTIVES, audit, emptyPolicy, serialize, setDirective, withDefaults, type Policy } from './csp'

const tool: Tool = {
  slug: 'csp-builder',
  name: 'CSP Header Builder',
  description: 'Build a Content-Security-Policy header and get an opinionated audit.',
  category: 'Web',
  keywords: ['csp', 'content security policy', 'security header', 'xss', 'directive'],
  render(root) {
    let policy: Policy = withDefaults()

    const output = el('code', { class: 'ts-mono ts-big-value' })
    const auditList = el('div', { class: 'ts-audit-list' })
    const grid = el('div', { class: 'ts-csp-grid' })

    function rerender() {
      const text = serialize(policy, 'Content-Security-Policy')
      output.textContent = text
      auditList.replaceChildren(
        ...audit(policy).map((finding) =>
          el('div', { class: `ts-audit ts-audit-${finding.severity}` }, finding.message),
        ),
      )
      grid.replaceChildren(...KNOWN_DIRECTIVES.map(renderRow))
    }

    function renderRow(directive: (typeof KNOWN_DIRECTIVES)[number]) {
      const active = policy.directives[directive.name] !== undefined
      const values = el('input', {
        class: 'ts-input ts-mono',
        value: (policy.directives[directive.name] ?? directive.values).join(' '),
        placeholder: directive.values.join(' ') || '(no value)',
        'aria-label': directive.name,
      }) as HTMLInputElement

      const toggle = el('input', { type: 'checkbox', checked: active }) as HTMLInputElement
      toggle.addEventListener('change', () => {
        policy = toggle.checked
          ? setDirective(policy, directive.name, values.value.split(/\s+/).filter(Boolean))
          : removeDirectiveLocal(policy, directive.name)
        rerender()
      })

      values.addEventListener('input', () => {
        if (!policy.directives[directive.name]) return
        policy = setDirective(policy, directive.name, values.value.split(/\s+/).filter(Boolean))
        rerender()
      })
      values.disabled = !active

      const row = el(
        'div',
        { class: 'ts-csp-row' },
        el('label', { class: 'ts-inline-field' }, toggle, directive.name),
        values,
      )
      row.append(el('span', { class: 'ts-hint ts-csp-hint' }, directive.hint))
      return row
    }

    function removeDirectiveLocal(p: Policy, name: string): Policy {
      const next = { ...p.directives }
      delete next[name]
      return { directives: next }
    }

    const strictButton = el('button', {
      class: 'ts-button ts-primary',
      type: 'button',
      onclick: () => {
        policy = withDefaults()
        rerender()
      },
    }, 'Load recommended policy')

    const clearButton = el('button', {
      class: 'ts-button',
      type: 'button',
      onclick: () => {
        policy = emptyPolicy()
        rerender()
      },
    }, 'Clear all')

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-row ts-wrap' }, strictButton, clearButton),
        el('h3', { class: 'ts-subhead' }, 'Directives'),
        grid,
        el('h3', { class: 'ts-subhead' }, 'Header'),
        output,
        el('div', { class: 'ts-row ts-wrap' },
          copyChip(() => output.textContent ?? ''),
          el('button', {
            class: 'ts-button',
            type: 'button',
            onclick: () => download('csp.txt', output.textContent ?? ''),
          }, 'Download')),
        el('h3', { class: 'ts-subhead' }, 'Audit'),
        auditList,
        el('p', { class: 'ts-note' }, 'The audit is a local heuristic — always test your policy against the real application.'),
      ),
    )

    rerender()
  },
}

export default tool
