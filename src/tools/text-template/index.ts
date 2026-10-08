import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
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
    const templateInput = el('textarea', { class: 'ts-textarea ts-mono', rows: 14, spellcheck: false }) as HTMLTextAreaElement
    templateInput.value = SAMPLE_TEMPLATE
    const contextInput = el('textarea', { class: 'ts-textarea ts-mono', rows: 14, spellcheck: false, placeholder: 'key=value\nuser.city=London' }) as HTMLTextAreaElement
    contextInput.value = SAMPLE_CONTEXT
    const output = el('pre', { class: 'ts-template-out' })
    const error = el('p', { class: 'ts-error', hidden: true })
    const vars = el('div', { class: 'ts-template-vars' })
    let result = ''

    function run() {
      try {
        result = render(templateInput.value, contextFromPairs(contextInput.value))
        output.textContent = result
        error.hidden = true
      } catch (err) {
        result = ''
        output.textContent = ''
        error.textContent = err instanceof TemplateError ? err.message : 'Could not render that template.'
        error.hidden = false
      }

      vars.replaceChildren()
      const names = placeholders(templateInput.value)
      if (names.length === 0) {
        vars.append(el('span', { class: 'ts-muted' }, 'No placeholders found.'))
      } else {
        for (const name of names) vars.append(el('code', { class: 'ts-template-var' }, `{{${name}}}`))
      }
    }

    templateInput.addEventListener('input', run)
    contextInput.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-template-grid' },
          el('div', { class: 'ts-field' }, el('label', {}, 'Template'), templateInput),
          el('div', { class: 'ts-field' }, el('label', {}, 'Data (key=value per line)'), contextInput),
        ),
        el('div', { class: 'ts-row ts-between' }, el('span', { class: 'ts-muted' }, 'Placeholders'), copyChip(() => result, 'Copy output')),
        vars,
        error,
        el('h3', { class: 'ts-subhead' }, 'Output'),
        output,
        el('p', { class: 'ts-note' }, 'Values are HTML-escaped by default; use {{{triple braces}}} for raw output. Templates are rendered locally and cannot run code.'),
      ),
    )

    run()
  },
}

export default tool
