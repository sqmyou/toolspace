import {
  actions,
  button,
  checkbox,
  copyButton,
  findingRow,
  findings,
  note,
  outputBlock,
  panel,
  textField,
  toolLayout,
  type Tone,
} from '../../core/components'
import { el } from '../../core/dom'
import { download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { KNOWN_DIRECTIVES, audit, emptyPolicy, serialize, setDirective, withDefaults, type Policy } from './csp'

const SEVERITY_TONES: Record<string, Tone> = { error: 'danger', warning: 'warn', info: 'neutral' }

const tool: Tool = {
  slug: 'csp-builder',
  name: 'CSP Header Builder',
  description: 'Build a Content-Security-Policy header and get an opinionated audit.',
  category: 'Web',
  keywords: ['csp', 'content security policy', 'security header', 'xss', 'directive'],
  render(root) {
    let policy: Policy = withDefaults()

    const output = outputBlock('', { label: 'Content-Security-Policy', copy: () => output.body.textContent ?? '' })
    const auditList = findings()
    const grid = el('div', { class: 'ts-csp-grid' })

    function rerender() {
      output.body.replaceChildren(serialize(policy, 'Content-Security-Policy'))
      output.setMeta('')
      auditList.replaceChildren(
        ...audit(policy).map((finding) =>
          findingRow({
            status: finding.severity,
            tone: SEVERITY_TONES[finding.severity],
            name: 'policy',
            message: finding.message,
          }),
        ),
      )
      grid.replaceChildren(...KNOWN_DIRECTIVES.map(renderRow))
    }

    function removeDirectiveLocal(current: Policy, name: string): Policy {
      const next = { ...current.directives }
      delete next[name]
      return { directives: next }
    }

    function renderRow(directive: (typeof KNOWN_DIRECTIVES)[number]) {
      const active = policy.directives[directive.name] !== undefined
      const values = textField({
        value: (policy.directives[directive.name] ?? directive.values).join(' '),
        placeholder: directive.values.join(' ') || '(no value)',
        mono: true,
        onInput: (value) => {
          if (!policy.directives[directive.name]) return
          policy = setDirective(policy, directive.name, value.split(/\s+/).filter(Boolean))
          rerender()
        },
      })
      values.disabled = !active

      const toggle = checkbox({
        label: directive.name,
        checked: active,
        onChange: (checked) => {
          policy = checked
            ? setDirective(policy, directive.name, values.value.split(/\s+/).filter(Boolean))
            : removeDirectiveLocal(policy, directive.name)
          rerender()
        },
      })

      return el(
        'div',
        { class: 'ts-csp-row' },
        el('div', { class: 'ts-csp-row__head' }, toggle, el('span', { class: 'ts-k-hint' }, directive.hint)),
        values,
      )
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Policy', icon: 'shield' },
          actions(
            button('Load recommended policy', { variant: 'primary', icon: 'check', onClick: () => {
              policy = withDefaults()
              rerender()
            } }),
            button('Clear all', { icon: 'refresh', onClick: () => {
              policy = emptyPolicy()
              rerender()
            } }),
          ),
          grid,
        ),
        panel(
          { title: 'Header', icon: 'code' },
          output,
          actions(copyButton(() => output.body.textContent ?? '', { label: 'Copy header', size: 'sm' }), button('Download', { icon: 'download', onClick: () => download('csp.txt', output.body.textContent ?? '') })),
        ),
        panel({ title: 'Audit', icon: 'alert' }, auditList),
        note('The audit is a local heuristic — always test your policy against the real application.'),
      ),
    )

    rerender()
  },
}

export default tool
