import {
  actions,
  button,
  checkbox,
  field,
  grid,
  note,
  outputBlock,
  panel,
  select,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import { download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { DEFAULT_OPTIONS, lineStats, processLines, type LineOptions } from './lines'

const tool: Tool = {
  slug: 'line-tools',
  name: 'Line Sorter & Deduplicator',
  description: 'Sort, deduplicate, reverse, shuffle, trim and number lines of text.',
  category: 'Text',
  keywords: ['lines', 'sort', 'dedupe', 'unique', 'shuffle', 'reverse', 'trim', 'number', 'list'],
  render(root) {
    const options: LineOptions = { ...DEFAULT_OPTIONS }
    const input = textarea({
      rows: 10,
      mono: true,
      placeholder: 'One item per line…',
      onInput: () => run(),
    })
    const pre = el('div', { class: 'ts-k-mono' })
    const block = outputBlock(pre, { label: 'Result', copy: () => rendered })

    const sortSelect = select({
      options: [
        { value: 'none', label: 'Keep order' },
        { value: 'asc', label: 'A → Z' },
        { value: 'desc', label: 'Z → A' },
        { value: 'length', label: 'By length' },
      ],
      value: 'none',
      onChange: (value) => {
        options.sort = value as LineOptions['sort']
        run()
      },
    })

    const numberSelect = select({
      options: [
        { value: 'none', label: 'No numbers' },
        { value: 'plain', label: '1 2 3' },
        { value: 'dot', label: '1. 2. 3.' },
        { value: 'paren', label: '1) 2) 3)' },
      ],
      value: 'none',
      onChange: (value) => {
        options.numbering = value as LineOptions['numbering']
        run()
      },
    })

    const switches: { key: keyof LineOptions; label: string }[] = [
      { key: 'trim', label: 'Trim' },
      { key: 'dropEmpty', label: 'Drop empty' },
      { key: 'dedupe', label: 'Deduplicate' },
      { key: 'dedupeCaseSensitive', label: 'Dedupe is case-sensitive' },
      { key: 'caseSensitive', label: 'Sort is case-sensitive' },
      { key: 'natural', label: 'Natural sort' },
      { key: 'reverse', label: 'Reverse' },
      { key: 'shuffle', label: 'Shuffle' },
    ]

    const controls = switches.map((item) => {
      const label = checkbox({
        label: item.label,
        checked: Boolean(options[item.key]),
        onChange: (checked) => {
          ;(options[item.key] as boolean) = checked
          run()
        },
      })
      return label
    })

    let rendered = ''

    function run() {
      rendered = processLines(input.value, options)
      pre.textContent = rendered
      const info = lineStats(rendered)
      block.setMeta(`${info.lines} lines · ${info.unique} unique · ${info.words} words · ${info.bytes} bytes`)
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Input', icon: 'text' },
          input,
          actions(
            button('Load sample', {
              icon: 'refresh',
              onClick: () => {
                input.value = 'banana\nApple\ncherry\nbanana\n\n  date  \nApple'
                run()
              },
            }),
            button('Clear', {
              icon: 'x',
              onClick: () => {
                input.value = ''
                run()
              },
            }),
          ),
        ),
        panel(
          { title: 'Order & numbering', icon: 'sliders' },
          actions(
            field(sortSelect, { label: 'Sort', grow: true }),
            field(numberSelect, { label: 'Numbering', grow: true }),
          ),
        ),
        panel({ title: 'Transforms', icon: 'type' }, grid(210, ...controls)),
        block,
        actions(
          button('Download .txt', {
            icon: 'download',
            onClick: () => download('lines.txt', rendered, 'text/plain'),
          }),
        ),
        note('All processing happens in your browser.'),
      ),
    )

    run()
  },
}

export default tool
