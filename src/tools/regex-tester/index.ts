import {
  card,
  cards,
  checkbox,
  copyRow,
  field,
  kvList,
  note,
  panel,
  textarea,
  textField,
  toolLayout,
} from '../../core/components'
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
    const pattern = textField({ value: '\\b\\w+@\\w+\\.\\w+\\b', mono: true, onInput: () => render() })
    const sample = textarea({ rows: 6, value: 'Contact dev@example.com or ops@team.io today.', onInput: () => render() })

    const flags = new Set<string>(['g'])
    const flagBoxes = FLAGS.map((flag) =>
      checkbox({
        label: flag,
        checked: flags.has(flag),
        onChange: (checked) => {
          if (checked) flags.add(flag)
          else flags.delete(flag)
          render()
        },
      }),
    )

    const error = note('', 'danger')
    error.hidden = true
    const preview = el('div', { class: 'ts-regex-preview' })
    const matches = kvList()
    const explanation = cards()

    function render() {
      const flagString = FLAGS.filter((flag) => flags.has(flag)).join('')
      const result = runRegex(pattern.value, flagString, sample.value)
      error.hidden = !result.error
      if (result.error) error.textContent = result.error

      preview.replaceChildren(
        ...highlight(sample.value, result.matches).map((part) => el('span', part.match ? { class: 'ts-regex-hit' } : {}, part.text)),
      )

      const found = result.matches.slice(0, 100)
      matches.replaceChildren(
        ...(found.length
          ? found.map((match, index) => copyRow(`#${index + 1} @${match.index}`, match.value || '(empty)', { copy: false }))
          : [note('No matches.')]),
      )

      explanation.replaceChildren(...explain(pattern.value).map((item) => card({ title: item.token }, item.meaning)))
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Pattern', icon: 'search' },
          field(pattern, { label: 'Pattern' }),
          el('div', { class: 'ts-k-actions' }, ...flagBoxes),
          error,
        ),
        panel({ title: 'Test text', icon: 'text' }, field(sample, { label: 'Test text' }), preview),
        panel({ title: 'Matches', icon: 'list' }, matches),
        panel({ title: 'Explanation', icon: 'info' }, explanation),
              ),
    )

    render()
  },
}

export default tool
