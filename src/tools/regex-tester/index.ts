import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { explain, highlight, runRegex } from './regex'

const FLAGS = ['g', 'i', 'm', 's', 'u', 'y'] as const

const tool: Tool = {
  slug: 'regex-tester',
  name: 'Regex Tester & Explainer',
  description: 'Test a regular expression against text and read a plain-English breakdown.',
  category: 'Regex',
  keywords: ['regex', 'regexp', 'regular expression', 'match', 'capture group', 'pattern'],
  render(root) {
    const pattern = el('input', {
      class: 'ts-input ts-mono',
      value: '\\b\\w+@\\w+\\.\\w+\\b',
      spellcheck: false,
      'aria-label': 'Pattern',
    }) as HTMLInputElement
    const sample = el('textarea', {
      class: 'ts-textarea',
      rows: 6,
      value: 'Contact dev@example.com or ops@team.io today.',
      'aria-label': 'Test text',
    }) as HTMLTextAreaElement

    const flags = new Set<string>(['g'])
    const flagRow = el('div', { class: 'ts-row ts-wrap' })
    for (const flag of FLAGS) {
      const box = el('input', { type: 'checkbox', checked: flags.has(flag) }) as HTMLInputElement
      box.addEventListener('change', () => {
        if (box.checked) flags.add(flag)
        else flags.delete(flag)
        render()
      })
      flagRow.append(el('label', { class: 'ts-inline-field' }, box, flag))
    }

    const error = el('p', { class: 'ts-error', hidden: true })
    const preview = el('div', { class: 'ts-regex-preview' })
    const matchList = el('div', { class: 'ts-copy-list' })
    const explanation = el('div', { class: 'ts-explain-list' })

    function render() {
      const flagString = FLAGS.filter((f) => flags.has(f)).join('')
      const { matches, error: err } = runRegex(pattern.value, flagString, sample.value)
      error.hidden = !err
      if (err) error.textContent = err

      const parts = highlight(sample.value, matches)
      preview.replaceChildren(
        ...parts.map((part) => el('span', part.match ? { class: 'ts-regex-hit' } : {}, part.text)),
      )

      matchList.replaceChildren(
        el('p', { class: 'ts-muted' }, `${matches.length} match${matches.length === 1 ? '' : 'es'}`),
        ...matches.slice(0, 100).map((match, index) =>
          el(
            'div',
            { class: 'ts-copy-row' },
            el('span', { class: 'ts-muted' }, `#${index + 1} @${match.index}`),
            el('span', { class: 'ts-value ts-mono' }, match.value || '(empty)'),
          ),
        ),
      )

      explanation.replaceChildren(
        ...explain(pattern.value).map((item) =>
          el(
            'div',
            { class: 'ts-explain-row' },
            el('code', { class: 'ts-mono ts-value' }, item.token),
            el('span', { class: 'ts-muted' }, item.meaning),
          ),
        ),
      )
    }

    pattern.addEventListener('input', render)
    sample.addEventListener('input', render)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Pattern'), pattern),
        flagRow,
        error,
        el('div', { class: 'ts-field' }, el('label', {}, 'Test text'), sample),
        el('h3', { class: 'ts-subhead' }, 'Matches'),
        preview,
        matchList,
        el('h3', { class: 'ts-subhead' }, 'Explanation'),
        explanation,
        el('p', { class: 'ts-note' }, 'The expression runs in your browser against your text only.'),
      ),
    )

    render()
  },
}

export default tool
