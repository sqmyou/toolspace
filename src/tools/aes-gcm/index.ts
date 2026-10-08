import { el } from '../../core/dom'
import { copyChip, download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { decrypt, encrypt, isBundle } from './aes'

const tool: Tool = {
  slug: 'aes-gcm',
  name: 'AES-GCM Encryptor / Decryptor',
  description: 'Encrypt and decrypt text with a passphrase using AES-256-GCM in your browser.',
  category: 'Crypto',
  keywords: ['aes', 'gcm', 'encrypt', 'decrypt', 'pbkdf2', 'cipher', 'webcrypto'],
  render(root) {
    const passphrase = el('input', { class: 'ts-input', type: 'password', placeholder: 'Passphrase', 'aria-label': 'Passphrase' }) as HTMLInputElement
    const plaintext = el('textarea', { class: 'ts-textarea', rows: 5, placeholder: 'Text to encrypt…', 'aria-label': 'Plaintext' }) as HTMLTextAreaElement
    const bundle = el('textarea', { class: 'ts-textarea ts-mono', rows: 5, placeholder: 'Bundle to decrypt (tsgcm1.…)', 'aria-label': 'Ciphertext' }) as HTMLTextAreaElement
    const output = el('div', { class: 'ts-json-block' })
    const outHead = el('div', { class: 'ts-json-head' })
    const outText = el('textarea', { class: 'ts-textarea', rows: 5, readonly: true }) as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })

    function showError(err: unknown) {
      error.textContent = err instanceof Error ? err.message : 'Something went wrong.'
      error.hidden = false
    }

    async function runEncrypt() {
      try {
        const value = await encrypt(passphrase.value, plaintext.value)
        error.hidden = true
        output.hidden = false
        outHead.replaceChildren(el('span', {}, 'Encrypted bundle'), copyChip(() => outText.value, 'Copy'))
        outText.value = value
      } catch (err) {
        showError(err)
      }
    }

    async function runDecrypt() {
      try {
        const value = await decrypt(passphrase.value, bundle.value)
        error.hidden = true
        output.hidden = false
        outHead.replaceChildren(el('span', {}, 'Decrypted text'), copyChip(() => outText.value, 'Copy'))
        outText.value = value
      } catch (err) {
        showError(err)
      }
    }

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Passphrase'), passphrase),
        el('div', { class: 'ts-field' }, el('label', {}, 'Encrypt'), plaintext),
        el('div', { class: 'ts-row ts-wrap' }, el('button', { class: 'ts-button ts-primary', type: 'button', onclick: runEncrypt }, 'Encrypt')),
        el('div', { class: 'ts-field' }, el('label', {}, 'Decrypt'), bundle),
        el('div', { class: 'ts-row ts-wrap' }, el('button', { class: 'ts-button', type: 'button', onclick: runDecrypt }, 'Decrypt')),
        error,
        output,
        outHead,
        outText,
        el('div', { class: 'ts-row ts-wrap' }, el('button', {
          class: 'ts-button',
          type: 'button',
          onclick: () => download('encrypted.txt', outText.value),
        }, 'Download result')),
        el('p', { class: 'ts-note' }, 'AES-256-GCM with PBKDF2-SHA256 (250,000 iterations). The passphrase and text never leave this page.'),
        isBundle(bundle.value) ? el('p', { class: 'ts-hint' }, 'Bundle detected.') : null,
      ),
    )
  },
}

export default tool
