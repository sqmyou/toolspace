import {
  actions,
  badge,
  button,
  download,
  field,
  note,
  outputBlock,
  panel,
  textField,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { decrypt, encrypt, isBundle } from './aes'

const tool: Tool = {
  slug: 'aes-gcm',
  name: 'AES-GCM Encryptor / Decryptor',
  description: 'Encrypt and decrypt text with a passphrase using AES-256-GCM.',
  category: 'Security',
  keywords: ['aes', 'gcm', 'encrypt', 'decrypt', 'pbkdf2', 'cipher', 'webcrypto'],
  render(root) {
    const passphrase = textField({ type: 'password', placeholder: 'Passphrase', onInput: () => refreshHint() })
    const plaintext = textarea({ rows: 5, placeholder: 'Text to encrypt…' })
    const bundle = textarea({ rows: 5, mono: true, placeholder: 'Bundle to decrypt (tsgcm1.…)', onInput: () => refreshHint() })
    const error = note('', 'danger')
    error.hidden = true
    const hint = el('div', { class: 'ts-k-actions' })
    let result = ''
    const output = outputBlock('', { label: 'Result', copy: () => result, meta: '' })

    function showError(err: unknown) {
      error.textContent = err instanceof Error ? err.message : 'Something went wrong.'
      error.hidden = false
    }

    function refreshHint() {
      hint.replaceChildren(...(isBundle(bundle.value) ? [badge('Bundle detected', 'ok')] : []))
    }

    async function runEncrypt() {
      try {
        result = await encrypt(passphrase.value, plaintext.value)
        error.hidden = true
        output.setLabel('Encrypted bundle')
        output.body.replaceChildren(result)
        output.setMeta(`${result.length} characters`)
      } catch (err) {
        showError(err)
      }
    }

    async function runDecrypt() {
      try {
        result = await decrypt(passphrase.value, bundle.value)
        error.hidden = true
        output.setLabel('Decrypted text')
        output.body.replaceChildren(result)
        output.setMeta(`${result.length} characters`)
      } catch (err) {
        showError(err)
      }
    }

    root.append(
      toolLayout(
        {},
        panel(
          { title: 'Passphrase', icon: 'key' },
          field(passphrase, { label: 'Passphrase' }),
                  ),
        panel(
          { title: 'Encrypt', icon: 'lock' },
          field(plaintext, { label: 'Plaintext' }),
          actions(button('Encrypt', { variant: 'primary', icon: 'lock', onClick: runEncrypt })),
        ),
        panel(
          { title: 'Decrypt', icon: 'key2' },
          field(bundle, { label: 'Bundle' }),
          hint,
          actions(button('Decrypt', { icon: 'key2', onClick: runDecrypt })),
        ),
        error,
        output,
        actions(
          button('Download result', { icon: 'download', onClick: () => download('encrypted.txt', result) }),
        ),
              ),
    )

    refreshHint()
  },
}

export default tool
