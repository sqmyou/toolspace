import {
  actions,
  button,
  checkbox,
  copyButton,
  download,
  field,
  grid,
  outputBlock,
  panel,
  select,
  textField,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { generateLorem, type WordSource } from './lorem'

const tool: Tool = {
  slug: 'lorem-ipsum',
  name: 'Lorem Ipsum Generator',
  description: 'Generate placeholder text by words, sentences or paragraphs.',
  category: 'Text',
  keywords: ['lorem', 'ipsum', 'placeholder', 'dummy text', 'filler'],
  render(root) {
    let source: WordSource = 'classic'
    let unit: 'paragraphs' | 'sentences' | 'words' = 'paragraphs'
    let classicOpening = true
    const count = textField({ type: 'number', value: '3', mono: true, onInput: () => generate() })
    const output = outputBlock('', { label: 'Placeholder text', copy: () => output.body.textContent ?? '' })

    const sourceControl = select({
      options: [
        { value: 'classic', label: 'Classic Latin' },
        { value: 'software', label: 'Software' },
      ],
      value: 'classic',
      onChange: (value) => {
        source = value as WordSource
        generate()
      },
    })

    const unitControl = select({
      options: [
        { value: 'paragraphs', label: 'Paragraphs' },
        { value: 'sentences', label: 'Sentences' },
        { value: 'words', label: 'Words' },
      ],
      value: 'paragraphs',
      onChange: (value) => {
        unit = value as typeof unit
        generate()
      },
    })

    function generate() {
      const text = generateLorem({ source, unit, count: Number(count.value) || 1, classicOpening })
      output.body.replaceChildren(text)
      output.setMeta(`${text.length} characters`)
    }

    root.append(
      toolLayout(
        {},
        panel(
          { title: 'Shape', icon: 'sliders' },
          grid(160, field(sourceControl, { label: 'Source' }), field(unitControl, { label: 'Unit' }), field(count, { label: 'Count' })),
          actions(checkbox({ label: 'Start with “Lorem ipsum…”', checked: true, onChange: (checked) => { classicOpening = checked; generate() } })),
        ),
        output,
        actions(
          button('Regenerate', { variant: 'primary', icon: 'refresh', onClick: generate }),
          copyButton(() => output.body.textContent ?? '', { label: 'Copy' }),
          button('Download', { icon: 'download', onClick: () => download('lorem-ipsum.txt', output.body.textContent ?? '') }),
        ),
              ),
    )

    generate()
  },
}

export default tool
