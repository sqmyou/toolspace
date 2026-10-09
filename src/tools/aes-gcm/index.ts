import {
  actions,
  badge,
  button,
  download,
  field,
  note,
  outputBlock,
  panel,
  segmented,
  textField,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { type AesMode, bundleMode, decrypt, encrypt } from './aes'

const MODES: { value: AesMode; label: string }[] = [
  { value: 'gcm', label: 'GCM' },
  { value: 'cbc', label: 'CBC' },
  { value: 'ctr', label: 'CTR' },
]

const UNAUTHENTICATED_NOTE =
  'CBC and CTR are not authenticated: a wrong passphrase can produce garbage instead of an error, and a changed ciphertext is not detected. Use GCM unless you need a specific mode for interoperability.'

const tool: Tool = {
  slug: 'aes-gcm',
  name: 'AES Encryptor / Decryptor',
  description: 'Encrypt and decrypt text with a passphrase using AES-256 in GCM, CBC or CTR mode.',
  category: 'Security',
  icon: 'lock',
  keywords: ['aes', 'gcm', 'cbc', 'ctr', 'encrypt', 'decrypt', 'pbkdf2', 'cipher', 'webcrypto'],
  render(root) {
    let mode: AesMode = 'gcm'
    const passphrase = textField({ type: 'password', placeholder: 'Passphrase', onInput: () => refreshHint() })
    const plaintext = textarea({ rows: 5, placeholder: 'Text to encrypt…' })
    const bundle = textarea({ rows: 5, mono: true, placeholder: 'Bundle to decrypt (tsgcm1.… or tsaes1.…)', onInput: () => refreshHint() })
    const error = note('', 'danger')
    error.hidden = true
    const hint = el('div', { class: 'ts-k-actions' })
    let result = ''
    const output = outputBlock('', { label: 'Result', copy: () => result, meta: '' })

    // Only shown for CBC/CTR, where the mode is not authenticated.
    const modeWarning = note(UNAUTHENTICATED_NOTE, 'warn')

    const modeControl = segmented({
      label: 'Mode',
      value: mode,
      items: MODES,
      onChange: (value) => {
        mode = value as AesMode
        syncMode()
        refreshHint()
      },
    })

    function syncMode() {
      modeWarning.hidden = mode === 'gcm'
    }

    function showError(err: unknown) {
      error.textContent = err instanceof Error ? err.message : 'Something went wrong.'
      error.hidden = false
    }

    function refreshHint() {
      const detected = bundleMode(bundle.value)
      const badges: HTMLElement[] = []
      if (detected) {
        badges.push(badge(`Bundle detected · ${detected.toUpperCase()}`, 'ok'))
        if (detected !== 'gcm') badges.push(badge('Not authenticated', 'warn'))
      }
      hint.replaceChildren(...badges)
    }

    async function runEncrypt() {
      try {
        result = await encrypt(passphrase.value, plaintext.value, mode)
        error.hidden = true
        output.setLabel(`Encrypted bundle (${mode.toUpperCase()})`)
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
          modeControl,
          modeWarning,
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

    syncMode()
    refreshHint()
  },
}

export default tool
