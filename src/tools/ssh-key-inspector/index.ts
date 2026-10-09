import {
  badge,
  copyRow,
  field,
  kvList,
  note,
  panel,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { inspectPrivateKey, inspectPublicKey, isPrivateKey, SshError, type SshKey } from './ssh'

const tool: Tool = {
  slug: 'ssh-key-inspector',
  name: 'SSH Key Inspector',
  description: 'Read the type, size and fingerprints of an SSH public or OpenSSH private key.',
  category: 'Security',
  keywords: ['ssh', 'key', 'fingerprint', 'ed25519', 'rsa', 'ecdsa', 'authorized_keys', 'known_hosts'],
  render(root) {
    const input = textarea({
      rows: 6,
      placeholder: 'ssh-ed25519 AAAAC3Nza… user@host\n\nor paste an -----BEGIN OPENSSH PRIVATE KEY----- block',
      onInput: () => {
        if (debounce !== undefined) window.clearTimeout(debounce)
        debounce = window.setTimeout(() => void run(), 150)
      },
    })
    const error = note('', 'danger')
    error.hidden = true
    const output = kvList()
    const badges = el('div', { class: 'ts-k-actions' })
    let debounce: number | undefined
    let token = 0

    function renderKey(key: SshKey) {
      const rows: HTMLElement[] = [
        copyRow('Type', key.type),
        copyRow('Algorithm', key.label),
      ]
      if (key.curve) rows.push(copyRow('Curve', key.curve))
      if (key.bits) rows.push(copyRow('Size', `${key.bits} bits`))
      if (key.comment) rows.push(copyRow('Comment', key.comment))
      if (key.kind === 'private') rows.push(copyRow('Encrypted', key.encrypted ? 'yes' : 'no', { copy: false }))
      rows.push(copyRow('SHA-256 fingerprint', key.fingerprints.sha256))
      rows.push(copyRow('MD5 fingerprint', key.fingerprints.md5))

      badges.replaceChildren(
        badge(key.kind === 'private' ? 'Private key' : 'Public key', key.kind === 'private' ? 'warn' : 'ok'),
        badge(key.label, 'neutral'),
      )
      output.replaceChildren(...rows)
    }

    async function run() {
      const current = ++token
      output.replaceChildren()
      badges.replaceChildren()
      const text = input.value.trim()
      if (!text) {
        error.hidden = true
        return
      }
      try {
        const key = isPrivateKey(text) ? await inspectPrivateKey(text) : await inspectPublicKey(text)
        if (current !== token) return
        renderKey(key)
        error.hidden = true
      } catch (err) {
        if (current !== token) return
        error.textContent = err instanceof SshError ? err.message : 'Could not read that SSH key.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'SSH key', icon: 'key' },
          field(input, { label: 'SSH key' }),
          badges,
          error,
        ),
        panel({ title: 'Details', icon: 'info' }, output),
              ),
    )
  },
}

export default tool
