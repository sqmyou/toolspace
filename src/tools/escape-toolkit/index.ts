import {
  field,
  note,
  outputBlock,
  panel,
  segmented,
  select,
  textarea,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { escape, FLAVORS, unescape, type Flavor } from './escape'

const tool: Tool = {
  slug: 'escape-toolkit',
  name: 'Escape / Unescape',
  description: 'Escape or unescape text for JSON, JS, HTML, XML, URL, SQL, shell, regex and CSV.',
  category: 'Text',
  keywords: ['escape', 'unescape', 'encode', 'decode', 'json', 'html', 'url', 'sql', 'shell', 'regex', 'csv'],
  render(root) {
    const input = textarea({ rows: 6, placeholder: 'Text to escape…', onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    let direction: 'escape' | 'unescape' = 'escape'
    let rendered = ''
    const output = outputBlock('', { label: 'Result', copy: () => rendered })

    const flavor = select({
      options: FLAVORS.map((item) => ({ value: item.value, label: item.label })),
      value: FLAVORS[0].value,
      onChange: () => run(),
    })

    const mode = segmented({
      label: 'Direction',
      value: direction,
      items: [
        { value: 'escape', label: 'Escape' },
        { value: 'unescape', label: 'Unescape' },
      ],
      onChange: (value) => {
        direction = value as 'escape' | 'unescape'
        run()
      },
    })

    function run() {
      const text = input.value
      if (!text) {
        rendered = ''
        output.body.replaceChildren('')
        output.setLabel('Result')
        error.hidden = true
        return
      }
      try {
        rendered = direction === 'escape' ? escape(text, flavor.value as Flavor) : unescape(text, flavor.value as Flavor)
        output.body.replaceChildren(rendered)
        output.setLabel(direction === 'escape' ? 'Escaped' : 'Unescaped')
        output.setMeta(`${rendered.length} chars`)
        error.hidden = true
      } catch {
        rendered = ''
        output.body.replaceChildren('')
        output.setMeta('')
        error.textContent = 'That text could not be unescaped for this flavour.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Input', icon: 'text' },
          field(mode, { label: 'Direction' }),
          field(flavor, { label: 'Flavour' }),
          input,
          error,
        ),
        output,
        note('Everything is escaped locally. The CSV flavour also blocks spreadsheet formula injection.'),
      ),
    )

    run()
  },
}

export default tool
