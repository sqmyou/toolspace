import {
  actions,
  button,
  field,
  note,
  outputBlock,
  panel,
  select,
  textarea,
  toolLayout,
} from '../../core/components'
import { download } from '../../core/ui'
import type { Tool } from '../../core/types'
import {
  base32Decode, base32Encode, base58CheckDecode, base58CheckEncode, base58Decode, base58Encode,
  bytesFromText, fromBinary, fromHex, textFromBytes, toBinary, toHex,
} from './base'

type Format = 'base32' | 'base58' | 'base58check' | 'hex' | 'binary'

const tool: Tool = {
  slug: 'base-encodings',
  name: 'Base32 / Base58 / Hex / Binary Codec',
  description: 'Convert text to and from Base32 (RFC 4648 or Crockford), Base58, Base58Check, hex and binary.',
  category: 'Data',
  keywords: ['base32', 'base58', 'base58check', 'hex', 'binary', 'encode', 'decode'],
  render(root) {
    let format: Format = 'base32'
    let variant: 'rfc4648' | 'crockford' = 'rfc4648'

    const formatSelect = select({
      options: [
        { value: 'base32', label: 'Base32' },
        { value: 'base58', label: 'Base58' },
        { value: 'base58check', label: 'Base58Check' },
        { value: 'hex', label: 'Hex' },
        { value: 'binary', label: 'Binary' },
      ],
      value: format,
      onChange: (value) => {
        format = value as Format
        variantField.hidden = format !== 'base32'
      },
    })

    const variantSelect = select({
      options: [
        { value: 'rfc4648', label: 'RFC 4648 (A-Z, 2-7)' },
        { value: 'crockford', label: 'Crockford (no I, L, O, U)' },
      ],
      value: variant,
      onChange: (value) => {
        variant = value as 'rfc4648' | 'crockford'
      },
    })
    const variantField = field(variantSelect, { label: 'Base32 alphabet', hint: 'Crockford drops padding and folds I, L and O when decoding.' })
    variantField.hidden = format !== 'base32'

    const input = textarea({ rows: 6, placeholder: 'Text to encode, or encoded value to decode…' })
    input.setAttribute('aria-label', 'Input')

    const outText = textarea({ rows: 6, readonly: true })
    const output = outputBlock('', { label: 'Result', copy: () => outText.value })
    output.body.replaceChildren(outText)

    const error = note('', 'danger')
    error.hidden = true

    function showOutput(label: string, value: string) {
      error.hidden = true
      output.hidden = false
      output.setLabel(label)
      output.setMeta(`${value.length} characters`)
      outText.value = value
    }

    function fail(err: unknown) {
      output.hidden = false
      output.setLabel('Error')
      output.setMeta('')
      outText.value = ''
      error.textContent = err instanceof Error ? err.message : 'Could not convert this value.'
      error.hidden = false
    }

    async function run(action: 'encode' | 'decode') {
      try {
        const bytes = bytesFromText(input.value)
        if (action === 'encode') {
          const value =
            format === 'base32' ? base32Encode(bytes, { variant })
            : format === 'base58' ? base58Encode(bytes)
            : format === 'base58check' ? await base58CheckEncode(bytes)
            : format === 'hex' ? toHex(bytes, true)
            : toBinary(bytes)
          showOutput(`Encoded · ${format}`, value)
          return
        }
        const decoded =
          format === 'base32' ? base32Decode(input.value, { variant })
          : format === 'base58' ? base58Decode(input.value.trim())
          : format === 'base58check' ? await base58CheckDecode(input.value.trim())
          : format === 'hex' ? fromHex(input.value)
          : fromBinary(input.value)
        showOutput('Decoded text', textFromBytes(decoded))
      } catch (err) {
        fail(err)
      }
    }

    root.append(
      toolLayout(
        {},
        panel({ title: 'Input', icon: 'text' }, field(formatSelect, { label: 'Encoding' }), variantField, field(input, { label: 'Value' })),
        error,
        output,
        actions(
          button('Encode', { icon: 'arrowDown', variant: 'primary', onClick: () => void run('encode') }),
          button('Decode', { icon: 'arrowUp', onClick: () => void run('decode') }),
          button('Download', { icon: 'download', onClick: () => download('encoded.txt', outText.value) }),
        ),
      ),
    )
  },
}

export default tool
