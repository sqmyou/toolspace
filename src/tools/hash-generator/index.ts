import {
  actions,
  copyRow,
  field,
  note,
  panel,
  select,
  textField,
  textarea,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { hash, HashError, hmac, HASH_ALGORITHMS, HMAC_ALGORITHMS } from './hash'

const tool: Tool = {
  slug: 'hash-generator',
  name: 'Hash & HMAC Generator',
  description: 'Compute SHA-1/256/384/512, MD5 and HMAC digests locally.',
  category: 'Security',
  keywords: ['hash', 'digest', 'sha', 'sha256', 'sha512', 'md5', 'hmac', 'checksum', 'checksum'],
  render(root) {
    const input = textarea({ rows: 5, placeholder: 'Text to hash…', value: 'hello world' })
    const secret = textField({
      type: 'password',
      spellcheck: false,
      placeholder: 'Secret key (for HMAC)…',
    })

    const encoding = select({
      value: 'hex',
      options: [
        { value: 'hex', label: 'Hex' },
        { value: 'base64', label: 'Base64' },
      ],
    })

    const error = note('', 'danger')
    error.hidden = true
    const output = document.createElement('div')
    output.className = 'ts-k-kvlist'

    let token = 0

    async function run() {
      const current = ++token
      const mode = encoding.value as 'hex' | 'base64'
      const lines: HTMLElement[] = []
      try {
        for (const algorithm of HASH_ALGORITHMS) {
          lines.push(copyRow(algorithm, await hash(input.value, algorithm, mode)))
        }
        if (secret.value) {
          for (const algorithm of HMAC_ALGORITHMS) {
            lines.push(copyRow(`HMAC-${algorithm}`, await hmac(input.value, secret.value, algorithm, mode)))
          }
        }
        if (current !== token) return
        error.hidden = true
        output.replaceChildren(...lines)
      } catch (err) {
        if (current !== token) return
        output.replaceChildren()
        error.textContent = err instanceof HashError ? err.message : 'Could not compute the digest.'
        error.hidden = false
      }
    }

    input.addEventListener('input', run)
    secret.addEventListener('input', run)
    encoding.addEventListener('change', run)

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'Input', icon: 'hash' }, input),
        panel(
          { title: 'Digest options', icon: 'sliders' },
          actions(
            field(encoding, { label: 'Encoding', grow: true }),
            field(secret, { label: 'HMAC secret (optional)', grow: true }),
          ),
        ),
        error,
        panel({ title: 'Digests', icon: 'shield' }, output),
        note('Hashing runs in your browser. Your input and secret are never uploaded.'),
      ),
    )

    run()
  },
}

export default tool
