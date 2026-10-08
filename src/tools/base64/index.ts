import {
  actions,
  button,
  checkbox,
  dropzone,
  note,
  outputBlock,
  panel,
  textarea,
  toolLayout,
} from '../../core/components'
import { download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { decodeText, decodeTextUrl, encodeText, encodeTextUrl, toDataUri } from './base64'

const tool: Tool = {
  slug: 'base64',
  name: 'Base64 / Base64URL Codec',
  description: 'Encode and decode Base64 text or files, including the URL-safe variant.',
  category: 'Encoding',
  keywords: ['base64', 'base64url', 'encode', 'decode', 'data uri', 'atob', 'btoa'],
  render(root) {
    const input = textarea({ placeholder: 'Text to encode, or paste Base64 to decode…', rows: 6 })
    const outText = textarea({ rows: 8, readonly: true })

    let urlSafe = false
    let lastAction: 'encode' | 'decode' = 'encode'

    const error = note('', 'danger')
    error.hidden = true
    const output = outputBlock('', { label: 'Output', copy: () => outText.value })
    const outputBody = output.querySelector('.ts-k-out__body') as HTMLElement
    outputBody.replaceChildren(outText)
    outputBody.style.whiteSpace = 'normal'
    output.hidden = true

    function setLabel(label: string) {
      const head = output.querySelector('.ts-k-out__label')
      if (head) head.textContent = label
    }

    function showOutput(label: string, value: string) {
      output.hidden = false
      error.hidden = true
      setLabel(label)
      outText.value = value
    }

    function encode() {
      lastAction = 'encode'
      showOutput('Encoded', urlSafe ? encodeTextUrl(input.value) : encodeText(input.value))
    }

    function decode() {
      lastAction = 'decode'
      try {
        showOutput('Decoded', urlSafe ? decodeTextUrl(input.value) : decodeText(input.value))
      } catch (err) {
        output.hidden = false
        error.textContent = err instanceof Error ? err.message : 'Could not decode this value.'
        error.hidden = false
        setLabel('Decoded')
        outText.value = ''
      }
    }

    const urlSafeBox = checkbox({
      label: 'URL-safe',
      hint: 'no padding, - and _ instead of + and /',
      onChange: (checked) => {
        urlSafe = checked
        if (lastAction === 'encode') encode()
      },
    })

    const picker = dropzone({
      label: 'Encode a file as a data URI',
      hint: 'or',
      accept: '*/*',
      icon: 'file',
      onFiles: () => {},
      onBuffers: (buffers, files) => {
        showOutput(
          `File · ${files[0].name}`,
          toDataUri(new Uint8Array(buffers[0]), files[0].type || 'application/octet-stream'),
        )
      },
    })

    root.append(
      toolLayout(
        {},
        panel(
          { title: 'Input', icon: 'braces' },
          input,
          actions(
            urlSafeBox,
            button('Encode', { variant: 'primary', icon: 'arrowDown', onClick: encode }),
            button('Decode', { icon: 'arrowUp', onClick: decode }),
          ),
        ),
        error,
        output,
        panel(
          { title: 'From a file', icon: 'upload' },
          picker.root,
          actions(
            button('Download result', {
              icon: 'download',
              onClick: () => download('data-uri.txt', outText.value),
            }),
          ),
        ),
        note('Encoding and decoding happen in your browser; files never leave your machine.'),
      ),
    )
  },
}

export default tool
