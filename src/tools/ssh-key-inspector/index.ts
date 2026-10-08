import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { inspectPrivateKey, inspectPublicKey, isPrivateKey, SshError, type SshKey } from './ssh'

const tool: Tool = {
  slug: 'ssh-key-inspector',
  name: 'SSH Key Inspector',
  description: 'Read the type, size and fingerprints of an SSH public or OpenSSH private key.',
  category: 'Security',
  keywords: ['ssh', 'key', 'fingerprint', 'ed25519', 'rsa', 'ecdsa', 'authorized_keys', 'known_hosts'],
  render(root) {
    const input = el('textarea', {
      class: 'ts-textarea ts-mono',
      rows: 6,
      spellcheck: false,
      placeholder: 'ssh-ed25519 AAAAC3Nza… user@host\n\nor paste an -----BEGIN OPENSSH PRIVATE KEY----- block',
    }) as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const output = el('div', { class: 'ts-ssh' })
    let token = 0

    function row(label: string, value: string, copy = true) {
      return el(
        'div',
        { class: 'ts-ssh-row' },
        el('span', { class: 'ts-muted' }, label),
        copy ? copyChip(value) : el('code', { class: 'ts-ssh-value' }, value),
      )
    }

    async function renderKey(key: SshKey) {
      const rows: HTMLElement[] = [
        row('Kind', key.kind === 'private' ? 'Private key (handle with care)' : 'Public key', false),
        row('Type', key.type),
        row('Algorithm', key.label),
      ]
      if (key.curve) rows.push(row('Curve', key.curve))
      if (key.bits) rows.push(row('Size', `${key.bits} bits`))
      if (key.comment) rows.push(row('Comment', key.comment))
      if (key.kind === 'private') rows.push(row('Encrypted', key.encrypted ? 'yes' : 'no', false))
      rows.push(row('SHA-256 fingerprint', key.fingerprints.sha256))
      rows.push(row('MD5 fingerprint', key.fingerprints.md5))

      output.replaceChildren(el('section', { class: 'ts-ssh-section' }, ...rows))
      if (key.warnings.length) {
        const warnings = el('div', { class: 'ts-ssh-warnings' })
        for (const warning of key.warnings) warnings.append(el('p', { class: 'ts-ssh-warning' }, `⚠ ${warning}`))
        output.append(warnings)
      }
    }

    async function run() {
      const current = ++token
      const text = input.value.trim()
      output.replaceChildren()
      if (!text) {
        error.hidden = true
        return
      }
      try {
        const key = isPrivateKey(text) ? await inspectPrivateKey(text) : await inspectPublicKey(text)
        if (current !== token) return
        await renderKey(key)
        error.hidden = true
      } catch (err) {
        if (current !== token) return
        error.textContent = err instanceof SshError ? err.message : 'Could not read that SSH key.'
        error.hidden = false
      }
    }

    let debounce: number | undefined
    input.addEventListener('input', () => {
      if (debounce !== undefined) window.clearTimeout(debounce)
      debounce = window.setTimeout(() => void run(), 150)
    })

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'SSH key'), input),
        error,
        output,
        el('p', { class: 'ts-note' }, 'Keys are parsed in your browser. Fingerprints are computed locally — nothing is uploaded.'),
      ),
    )
  },
}

export default tool
