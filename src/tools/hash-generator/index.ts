import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { hash, HashError, hmac, HASH_ALGORITHMS, HMAC_ALGORITHMS } from './hash'

const tool: Tool = {
  slug: 'hash-generator',
  name: 'Hash & HMAC Generator',
  description: 'Compute SHA-1/256/384/512, MD5 and HMAC digests locally.',
  category: 'Security',
  keywords: ['hash', 'digest', 'sha', 'sha256', 'sha512', 'md5', 'hmac', 'checksum', 'checksum'],
  render(root) {
    const input = el('textarea', {
      class: 'ts-output ts-textarea',
      rows: 5,
      spellcheck: false,
      placeholder: 'Text to hash…',
      value: 'hello world',
    }) as HTMLTextAreaElement

    const secret = el('input', {
      class: 'ts-input ts-mono',
      type: 'password',
      spellcheck: false,
      placeholder: 'Secret key (for HMAC)…',
      'aria-label': 'HMAC secret key',
    }) as HTMLInputElement

    const encoding = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const value of ['hex', 'base64']) {
      encoding.append(el('option', { value, selected: value === 'hex' }, value))
    }

    const output = el('div', { class: 'ts-copy-list' })
    const error = el('p', { class: 'ts-error', hidden: true })

    function row(label: string, value: string) {
      const chip = el(
        'button',
        {
          class: 'ts-copy-chip ts-wrap-value',
          type: 'button',
          title: `Copy ${label}`,
          onclick: async () => {
            try {
              await navigator.clipboard.writeText(value)
              chip.textContent = 'Copied'
              setTimeout(() => (chip.textContent = value), 900)
            } catch {
              /* clipboard blocked; the value is still selectable */
            }
          },
        },
        value,
      )
      return el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, label), chip)
    }

    let token = 0

    async function run() {
      const current = ++token
      const mode = encoding.value as 'hex' | 'base64'
      const lines: HTMLElement[] = []
      try {
        for (const algorithm of HASH_ALGORITHMS) {
          lines.push(row(algorithm, await hash(input.value, algorithm, mode)))
        }
        if (secret.value) {
          for (const algorithm of HMAC_ALGORITHMS) {
            lines.push(row(`HMAC-${algorithm}`, await hmac(input.value, secret.value, algorithm, mode)))
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
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Input'), input),
        el(
          'div',
          { class: 'ts-row ts-between' },
          el('label', { class: 'ts-inline-field' }, el('span', {}, 'Output'), encoding),
          el('div', { class: 'ts-field ts-grow' }, el('label', {}, 'HMAC secret (optional)'), secret),
        ),
        error,
        output,
        el('p', { class: 'ts-note' }, 'Hashing runs in your browser. Your input and secret are never uploaded.'),
      ),
    )

    run()
  },
}

export default tool
