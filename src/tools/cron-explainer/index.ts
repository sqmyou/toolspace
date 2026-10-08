import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { parseCron, presets } from './cron'

const tool: Tool = {
  slug: 'cron-explainer',
  name: 'Cron Expression Explainer',
  description: 'Read a 5-field cron expression in plain English and see its next run times.',
  category: 'Web',
  keywords: ['cron', 'crontab', 'schedule', 'expression', 'explain', 'cron expression'],
  render(root) {
    const input = el('input', { class: 'ts-input ts-mono', value: '0 9 * * 1-5', spellcheck: false, 'aria-label': 'Cron expression' }) as HTMLInputElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const summary = el('p', { class: 'ts-cron-summary' })
    const fields = el('div', { class: 'ts-cron-fields' })
    const nextList = el('div', { class: 'ts-copy-list' })

    function run() {
      const result = parseCron(input.value)
      error.hidden = result.valid
      if (!result.valid) {
        error.textContent = result.error ?? 'Invalid expression'
        summary.textContent = ''
        fields.replaceChildren()
        nextList.replaceChildren()
        return
      }
      summary.textContent = result.description
      fields.replaceChildren(
        ...result.fields.map((field) =>
          el(
            'div',
            { class: 'ts-cron-field' },
            el('span', { class: 'ts-muted' }, field.name),
            el('code', { class: 'ts-mono ts-value' }, field.value),
            el('span', { class: 'ts-hint' }, field.description),
          ),
        ),
      )
      nextList.replaceChildren(
        el('p', { class: 'ts-muted' }, 'Next runs'),
        ...result.next.map((date) =>
          el(
            'div',
            { class: 'ts-copy-row' },
            el('span', { class: 'ts-mono ts-value' }, date.toLocaleString()),
            copyChip(() => date.toISOString()),
          ),
        ),
      )
    }

    input.addEventListener('input', run)

    const presetRow = el('div', { class: 'ts-row ts-wrap' })
    for (const preset of presets()) {
      presetRow.append(
        el('button', {
          class: 'ts-button',
          type: 'button',
          title: preset.expression,
          onclick: () => {
            input.value = preset.expression
            run()
          },
        }, preset.label),
      )
    }

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Expression (minute hour day-of-month month day-of-week)'), input),
        error,
        el('h3', { class: 'ts-subhead' }, 'In plain English'),
        summary,
        fields,
        el('h3', { class: 'ts-subhead' }, 'Presets'),
        presetRow,
        el('h3', { class: 'ts-subhead' }, 'Upcoming'),
        nextList,
        el('p', { class: 'ts-note' }, 'Parsing and the next-run search run entirely in your browser.'),
      ),
    )

    run()
  },
}

export default tool
