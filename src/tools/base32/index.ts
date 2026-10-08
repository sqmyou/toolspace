import {
  actions,
  button,
  checkbox,
  field,
  note,
  outputBlock,
  panel,
  segmented,
  select,
  stat,
  stats,
  textarea,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { decodeText, encodeText } from './base32'

const tool: Tool = {
  slug: 'base32',
  name: 'Base32 Encoder & Decoder',
  description: 'Encode and decode base32 in RFC 4648 and Crockford variants, with TOTP-friendly secrets.',
  category: 'Data',
  keywords: ['base32', 'rfc4648', 'crockford', 'encode', 'decode', 'totp', 'secret', '2fa'],
  render(root) {
    let direction: 'encode' | 'decode' = 'encode'
    let variant: 'rfc4648' | 'crockford' = 'rfc4648'
    let padding = true
    let result = ''

    const directionControl = segmented({
      label: 'Direction',
      items: [
        { value: 'encode', label: 'Text → Base32' },
        { value: 'decode', label: 'Base32 → Text' },
      ],
      value: direction,
      onChange: (value) => {
        direction = value as 'encode' | 'decode'
        sample()
      },
    })

    const variantControl = select({
      options: [
        { value: 'rfc4648', label: 'RFC 4648 (A-Z, 2-7)' },
        { value: 'crockford', label: 'Crockford (no I, L, O, U)' },
      ],
      value: variant,
      onChange: (value) => {
        variant = value as 'rfc4648' | 'crockford'
        run()
      },
    })

    const paddingBox = checkbox({
      label: 'Pad with "="',
      checked: true,
      onChange: (checked) => {
        padding = checked
        run()
      },
    })

    const input = textarea({ rows: 8, onInput: () => run() })
    const outputArea = textarea({ rows: 8, readonly: true })
    const output = outputBlock('', { label: 'Base32', copy: () => result })
    output.body.replaceChildren(outputArea)

    const error = note('', 'danger')
    error.hidden = true

    const figure = stats()

    function run() {
      try {
        const options = { variant, padding }
        result = direction === 'encode' ? encodeText(input.value, options) : decodeText(input.value, options)
        outputArea.value = result
        output.setLabel(direction === 'encode' ? 'Base32' : 'Text')
        output.setMeta(result ? `${result.length} characters` : '')
        error.hidden = true
        figure.replaceChildren(
          stat({ label: 'Characters', value: String(result.length) }),
          stat({ label: 'Variant', value: variant === 'rfc4648' ? 'RFC 4648' : 'Crockford' }),
          stat({ label: 'Direction', value: direction === 'encode' ? 'Encode' : 'Decode' }),
        )
      } catch (err) {
        result = ''
        outputArea.value = ''
        output.setMeta('')
        figure.replaceChildren()
        error.textContent = err instanceof Error ? err.message : 'Could not process that input.'
        error.hidden = false
      }
    }

    function sample() {
      input.value = direction === 'encode' ? 'toolspace' : 'ORSXG5A='
      run()
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Options', icon: 'sliders' },
          directionControl,
          actions(
            field(variantControl, { label: 'Variant' }),
            field(paddingBox, { label: 'Padding' }),
            button('Load sample', { icon: 'refresh', onClick: sample }),
          ),
        ),
        panel({ title: 'Input', icon: 'text' }, input),
        error,
        figure,
        output,
        note('RFC 4648 uses A-Z and 2-7 with "=" padding. Crockford drops padding and the letters I, L, O and U, and decoding folds 1/I/L and 0/O together.'),
      ),
    )

    sample()
  },
}

export default tool
