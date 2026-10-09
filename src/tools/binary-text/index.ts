import {
  actions,
  button,
  checkbox,
  field,
  note,
  outputBlock,
  panel,
  segmented,
  stat,
  stats,
  textarea,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { binaryStats, binaryToText, groupBits, textToBinary } from './binary'

const tool: Tool = {
  slug: 'binary-text',
  name: 'Binary Text Converter',
  description: 'Turn text into its UTF-8 binary form and back, with optional grouping and bit reversal.',
  category: 'Data',
  keywords: ['binary', 'bits', 'text', 'utf-8', 'encode', 'decode', '0b', 'convert'],
  render(root) {
    let direction = 'encode'
    const spacing = { on: true }
    const nibbles = { on: true }
    const reverse = { on: false }
    const input = textarea({ rows: 8, onInput: () => run() })
    let result = ''
    const output = outputBlock('', { label: 'Output', copy: () => result })
    const error = note('', 'danger')
    error.hidden = true
    const readout = stats()

    const options = [
      checkbox({ label: 'Space between bytes', checked: true, onChange: (checked) => { spacing.on = checked; run() } }),
      checkbox({ label: 'Group in nibbles', checked: true, onChange: (checked) => { nibbles.on = checked; run() } }),
      checkbox({ label: 'Reverse bits', onChange: (checked) => { reverse.on = checked; run() } }),
    ]

    function run() {
      try {
        if (direction === 'encode') {
          result = textToBinary(input.value, { spaced: spacing.on || nibbles.on, reversed: reverse.on })
          if (nibbles.on) result = groupBits(result, 4)
          readout.replaceChildren(
            stat({ label: 'Bits', value: String(textToBinary(input.value).length) }),
            stat({ label: 'Bytes', value: String(new TextEncoder().encode(input.value).length) }),
          )
        } else {
          result = binaryToText(input.value, { reversed: reverse.on })
          const info = binaryStats(input.value)
          readout.replaceChildren(
            stat({ label: 'Bits', value: String(info.bits) }),
            stat({ label: 'Bytes', value: String(info.bytes) }),
            stat({ label: 'Ones', value: `${info.ones} (${Math.round(info.density * 100)}%)` }),
          )
        }
        output.body.replaceChildren(result)
        output.setMeta('')
        error.hidden = true
      } catch (err) {
        result = ''
        output.body.replaceChildren('')
        output.setMeta('')
        readout.replaceChildren()
        error.textContent = err instanceof Error ? err.message : 'Could not process that input.'
        error.hidden = false
      }
    }

    function sample() {
      input.value = direction === 'encode' ? 'Hi' : '01001000 01101001'
      run()
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Input', icon: 'code' },
          segmented({
            label: 'Direction',
            value: 'encode',
            items: [
              { label: 'Text → Binary', value: 'encode' },
              { label: 'Binary → Text', value: 'decode' },
            ],
            onChange: (value) => {
              direction = value
              sample()
            },
          }),
          field(input, { label: 'Input' }),
          actions(button('Load sample', { icon: 'refresh', onClick: sample })),
          error,
        ),
        panel({ title: 'Options', icon: 'sliders' }, ...options),
        output,
        readout,
        note('Text is encoded as UTF-8, so a non-ASCII character becomes the two or more bytes you would find in a file.'),
      ),
    )

    sample()
  },
}

export default tool
