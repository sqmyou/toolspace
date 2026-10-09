import {
  actions,
  copyButton,
  field,
  note,
  outputBlock,
  panel,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { contextFromPairs, placeholders, render, TemplateError } from './template'

const SAMPLE_TEMPLATE = `Hi {{user.name}},

Your order {{order.id}} totals {{order.total}}.

Items:
{{#order.items}}- {{name}} ({{qty}})
{{/order.items}}
{{^order.items}}No items.\\n{{/order.items}}
Thanks!`

const SAMPLE_CONTEXT = `user.name=Ada
order.id=A-1001
order.total=42.00`

const tool: Tool = {
  slug: 'text-template',
  name: 'Text Template Renderer',
  description: 'Fill a mustache-style template with key=value data, with sections and escaping.',
  category: 'Text',
  keywords: ['template', 'mustache', 'interpolate', 'render', 'placeholder', 'snippet', 'scaffold'],
  render(root) {
    const template = textarea({ rows: 14, value: SAMPLE_TEMPLATE, onInput: () => run() })
    const context = textarea({ rows: 14, value: SAMPLE_CONTEXT, placeholder: 'key=value\nuser.city=London', onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    let result = ''
    const output = outputBlock('', { label: 'Output', copy: () => result })
    const vars = el('div', { class: 'ts-k-chips' })

    function run() {
      try {
        result = render(template.value, contextFromPairs(context.value))
        output.body.replaceChildren(result)
        output.setMeta('')
        error.hidden = true
      } catch (err) {
        result = ''
        output.body.replaceChildren('')
        output.setMeta('')
        error.textContent = err instanceof TemplateError ? err.message : 'Could not render that template.'
        error.hidden = false
      }

      const names = placeholders(template.value)
      vars.replaceChildren(
        ...(names.length
          ? names.map((name) =>
              el(
                'button',
                { class: 'ts-chip', type: 'button', title: 'Click to copy', onclick: () => void navigator.clipboard.writeText(`{{${name}}}`) },
                `{{${name}}}`,
              ),
            )
          : [note('No placeholders found.')]),
      )
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Template', icon: 'code' },
          el('div', { class: 'ts-k-split' }, field(template, { label: 'Template' }), field(context, { label: 'Data (key=value per line)' })),
          actions(copyButton(() => result, { label: 'Copy output', size: 'sm' })),
          error,
        ),
        panel({ title: 'Placeholders', icon: 'tag' }, vars),
        output,
        note('Values are HTML-escaped by default; use {{{triple braces}}} for raw output. Templates are rendered locally and cannot run code.'),
      ),
    )

    run()
  },
}

export default tool
