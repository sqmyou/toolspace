import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { DEFAULT_ITERATIONS, derive, describeCost, PBKDF2_HASHES, Pbkdf2Error, randomSalt, type DeriveOptions, type Pbkdf2Hash } from './pbkdf2'

const tool: Tool = {
  slug: 'pbkdf2',
  name: 'PBKDF2 Key Derivation',
  description: 'Derive a key from a password and salt with PBKDF2, and inspect the resulting digest.',
  category: 'Security',
  keywords: ['pbkdf2', 'kdf', 'derive', 'key', 'password', 'salt', 'iterations', 'hash'],
  render(root) {
    const passwordInput = el('input', { class: 'ts-input', type: 'password', value: '', spellcheck: false, placeholder: 'Password…', autocomplete: 'off' }) as HTMLInputElement
    const saltInput = el('input', { class: 'ts-input ts-mono', type: 'text', value: 'salt', spellcheck: false }) as HTMLInputElement
    const saltEncoding = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const encoding of ['utf8', 'hex', 'base64']) saltEncoding.append(el('option', { value: encoding }, encoding))
    const hashSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const hash of PBKDF2_HASHES) hashSelect.append(el('option', { value: hash, selected: hash === 'SHA-256' }, hash))
    const iterationsInput = el('input', { class: 'ts-input ts-mono', type: 'number', value: String(DEFAULT_ITERATIONS), min: '1', step: '1000' }) as HTMLInputElement
    const lengthInput = el('input', { class: 'ts-input ts-mono', type: 'number', value: '32', min: '1', max: '1024' }) as HTMLInputElement
    const cost = el('span', { class: 'ts-muted' })
    const error = el('p', { class: 'ts-error', hidden: true })
    const output = el('div', { class: 'ts-copy-list' })
    let token = 0

    async function run() {
      const current = ++token
      output.replaceChildren()
      try {
        const options: DeriveOptions = {
          iterations: Number(iterationsInput.value) || DEFAULT_ITERATIONS,
          hash: hashSelect.value as Pbkdf2Hash,
          length: Number(lengthInput.value) || 32,
          saltEncoding: saltEncoding.value as DeriveOptions['saltEncoding'],
        }
        cost.textContent = describeCost(options.iterations!)
        const result = await derive(passwordInput.value, saltInput.value, options)
        if (current !== token) return
        output.append(
          el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, 'Hex'), copyChip(result.hex)),
          el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, 'Base64'), copyChip(result.base64)),
        )
        error.hidden = true
      } catch (err) {
        if (current !== token) return
        error.textContent = err instanceof Pbkdf2Error ? err.message : 'Could not derive a key with those inputs.'
        error.hidden = false
      }
    }

    const newSalt = el('button', {
      class: 'ts-button',
      type: 'button',
      onclick: () => {
        saltInput.value = randomSalt(16)
        saltEncoding.value = 'hex'
        run()
      },
    }, 'Random salt')

    for (const input of [passwordInput, saltInput, iterationsInput, lengthInput]) input.addEventListener('input', run)
    for (const select of [saltEncoding, hashSelect]) select.addEventListener('change', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Password'), passwordInput),
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-field ts-grow' }, el('label', {}, 'Salt'), saltInput),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Salt encoding'), saltEncoding),
          newSalt,
        ),
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Hash'), hashSelect),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Iterations'), iterationsInput),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Length (bytes)'), lengthInput),
        ),
        el('div', { class: 'ts-row ts-between' }, el('span', {}, 'Cost'), cost),
        error,
        output,
        el('p', { class: 'ts-note' }, 'Derivation happens in your browser with the WebCrypto API. The password and salt never leave the page.'),
      ),
    )

    run()
  },
}

export default tool
