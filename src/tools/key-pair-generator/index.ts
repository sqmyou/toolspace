import {
  actions,
  badge,
  button,
  copyButton,
  field,
  note,
  outputBlock,
  panel,
  select,
  toolLayout,
  type Tone,
} from '../../core/components'
import { download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { generateKeyPair, type Algorithm } from './keypair'

const ALGORITHMS: Algorithm[] = ['ECDSA-P256', 'ECDSA-P384', 'Ed25519', 'RSA-2048', 'RSA-4096']

const tool: Tool = {
  slug: 'key-pair-generator',
  name: 'Key Pair Generator',
  description: 'Generate RSA, ECDSA or Ed25519 key pairs and export them as PEM.',
  category: 'Security',
  keywords: ['key pair', 'rsa', 'ecdsa', 'ed25519', 'pem', 'public key', 'private key'],
  render(root) {
    const algorithm = select({
      value: 'ECDSA-P256',
      options: ALGORITHMS.map((value) => ({ value, label: value })),
      onChange: () => void run(),
    })
    const publicKey = outputBlock('', { label: 'Public key (PEM)', copy: () => publicKey.body.textContent ?? '' })
    const privateKey = outputBlock('', { label: 'Private key (PEM)', copy: () => privateKey.body.textContent ?? '' })
    const error = note('', 'danger')
    error.hidden = true
    let status = badge('Not generated', 'neutral')
    const generate = button('Generate key pair', { icon: 'key', variant: 'primary', onClick: () => void run() })

    function setStatus(text: string, tone: Tone) {
      const next = badge(text, tone)
      status.replaceWith(next)
      status = next
    }

    async function run() {
      generate.disabled = true
      setStatus('Generating…', 'warn')
      error.hidden = true
      try {
        const pair = await generateKeyPair(algorithm.value as Algorithm)
        publicKey.body.replaceChildren(pair.publicKey)
        privateKey.body.replaceChildren(pair.privateKey)
        setStatus(pair.algorithm, 'ok')
      } catch (err) {
        setStatus('Failed', 'danger')
        error.textContent = err instanceof Error ? err.message : `Your browser does not support ${algorithm.value}`
        error.hidden = false
      } finally {
        generate.disabled = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Key pair', icon: 'key' },
          actions(field(algorithm, { label: 'Algorithm' }), generate, status),
          error,
          note('The private key is generated on this device. Keep it secret.', 'warn'),
        ),
        publicKey,
        privateKey,
        actions(
          copyButton(() => publicKey.body.textContent ?? '', { label: 'Copy public key', size: 'sm' }),
          button('Download private key', { icon: 'download', onClick: () => download('private-key.pem', privateKey.body.textContent ?? '') }),
        ),
      ),
    )

    void run()
  },
}

export default tool
