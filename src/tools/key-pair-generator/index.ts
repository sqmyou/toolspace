import { el } from '../../core/dom'
import { copyChip, download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { generateKeyPair, type Algorithm } from './keypair'

const ALGORITHMS: Algorithm[] = ['ECDSA-P256', 'ECDSA-P384', 'Ed25519', 'RSA-2048', 'RSA-4096']

const tool: Tool = {
  slug: 'key-pair-generator',
  name: 'Key Pair Generator',
  description: 'Generate RSA, ECDSA or Ed25519 key pairs and export them as PEM.',
  category: 'Crypto',
  keywords: ['key pair', 'rsa', 'ecdsa', 'ed25519', 'pem', 'public key', 'private key'],
  render(root) {
    let algorithm: Algorithm = 'ECDSA-P256'

    const select = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const value of ALGORITHMS) select.append(el('option', { value }, value))
    select.value = algorithm
    select.addEventListener('change', () => {
      algorithm = select.value as Algorithm
    })

    const publicKey = el('textarea', { class: 'ts-textarea ts-mono', rows: 7, readonly: true, placeholder: 'Public key (PEM)' }) as HTMLTextAreaElement
    const privateKey = el('textarea', { class: 'ts-textarea ts-mono', rows: 10, readonly: true, placeholder: 'Private key (PEM)' }) as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const status = el('span', { class: 'ts-muted' })
    const generateButton = el('button', { class: 'ts-button ts-primary', type: 'button' }) as HTMLButtonElement
    generateButton.textContent = 'Generate key pair'

    async function run() {
      generateButton.disabled = true
      status.textContent = 'Generating…'
      error.hidden = true
      try {
        const pair = await generateKeyPair(algorithm)
        publicKey.value = pair.publicKey
        privateKey.value = pair.privateKey
        status.textContent = `Generated ${pair.algorithm}`
      } catch (err) {
        status.textContent = ''
        error.textContent = err instanceof Error ? err.message : `Your browser does not support ${algorithm}`
        error.hidden = false
      } finally {
        generateButton.disabled = false
      }
    }

    generateButton.addEventListener('click', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el(
          'div',
          { class: 'ts-row ts-end ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Algorithm'), select),
          generateButton,
          status,
        ),
        error,
        el('h3', { class: 'ts-subhead' }, 'Public key'),
        publicKey,
        el('div', { class: 'ts-row ts-wrap' }, copyChip(() => publicKey.value, 'Copy public key')),
        el('h3', { class: 'ts-subhead' }, 'Private key'),
        privateKey,
        el('div', { class: 'ts-row ts-wrap' }, copyChip(() => privateKey.value, 'Copy private key'),
          el('button', {
            class: 'ts-button',
            type: 'button',
            onclick: () => download('private-key.pem', privateKey.value),
          }, 'Download private key')),
        el('p', { class: 'ts-warn' }, 'The private key is generated in your browser and is never transmitted. Keep it secret.'),
      ),
    )
  },
}

export default tool
