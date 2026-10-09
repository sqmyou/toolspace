import {
  actions,
  badge,
  cards,
  copyRow,
  dropzone,
  field,
  note,
  panel,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { fingerprints, parseCertificate, pemToDer, X509Error, type Certificate } from './x509'

const tool: Tool = {
  slug: 'x509-decoder',
  name: 'X.509 Certificate Decoder',
  description: 'Decode a PEM or DER certificate: subject, issuer, validity, key and extensions.',
  category: 'Security',
  keywords: ['x509', 'certificate', 'tls', 'ssl', 'pem', 'der', 'asn1', 'fingerprint', 'subject'],
  render(root) {
    const input = textarea({
      rows: 8,
      placeholder: 'Paste a PEM certificate (-----BEGIN CERTIFICATE-----) or drop a .pem/.crt/.der file.',
      onInput: () => run(),
    })
    const error = note('', 'danger')
    error.hidden = true
    const output = cards()
    const summary = el('div', { class: 'ts-k-actions' })
    let token = 0

    function section(title: string, rows: HTMLElement[]): HTMLElement {
      return panel({ title, icon: 'file' }, ...rows)
    }

    async function show(der: Uint8Array) {
      const current = ++token
      output.replaceChildren()
      summary.replaceChildren()
      try {
        const certificate: Certificate = parseCertificate(der)
        const prints = await fingerprints(der)
        if (current !== token) return

        const validity = `${certificate.notBefore.toISOString().slice(0, 10)} → ${certificate.notAfter.toISOString().slice(0, 10)}`
        const remaining = certificate.expired
          ? `expired ${Math.abs(certificate.daysRemaining)} days ago`
          : `${certificate.daysRemaining} days remaining`

        summary.append(
          badge(certificate.expired ? 'Expired' : 'Valid', certificate.expired ? 'danger' : 'ok'),
          badge(validity, 'neutral'),
          badge(remaining, 'neutral'),
        )

        output.replaceChildren(
          section('Certificate', [
            copyRow('Subject', certificate.subject),
            copyRow('Issuer', certificate.issuer),
            copyRow('Serial number', certificate.serialNumber),
            copyRow('Version', `v${certificate.version}`, { copy: false }),
            copyRow('Signature algorithm', certificate.signatureAlgorithm),
          ]),
          section('Validity', [
            copyRow('Not before', certificate.notBefore.toISOString()),
            copyRow('Not after', certificate.notAfter.toISOString()),
          ]),
          section('Public key', [
            copyRow('Algorithm', certificate.publicKey.algorithm),
            ...(certificate.publicKey.curve ? [copyRow('Curve', certificate.publicKey.curve)] : []),
            ...(certificate.publicKey.keySizeBits ? [copyRow('Key size', `${certificate.publicKey.keySizeBits} bits`, { copy: false })] : []),
          ]),
          section('Extensions', [
            copyRow('Basic constraints', certificate.basicConstraints ?? 'not present', { copy: false }),
            copyRow('CA', certificate.isCa ? 'yes' : 'no', { copy: false }),
            copyRow('Key usage', certificate.keyUsage.length ? certificate.keyUsage.join(', ') : 'not present', { copy: false }),
            copyRow('Extended key usage', certificate.extendedKeyUsage.length ? certificate.extendedKeyUsage.join(', ') : 'not present', { copy: false }),
            copyRow('Subject alternative names', certificate.subjectAltNames.length ? certificate.subjectAltNames.join('\n') : 'not present', { copy: false }),
          ]),
          section('Fingerprints', [copyRow('SHA-1', prints.sha1), copyRow('SHA-256', prints.sha256)]),
        )
        error.hidden = true
      } catch (err) {
        if (current !== token) return
        error.textContent = err instanceof X509Error ? err.message : 'Could not decode that certificate.'
        error.hidden = false
      }
    }

    function run() {
      const text = input.value.trim()
      if (!text) {
        output.replaceChildren()
        summary.replaceChildren()
        error.hidden = true
        return
      }
      try {
        void show(pemToDer(text))
      } catch (err) {
        error.textContent = err instanceof X509Error ? err.message : 'Could not read that input.'
        error.hidden = false
      }
    }

    const drop = dropzone({
      label: 'Drop a .pem, .crt or .der certificate',
      hint: 'or choose one',
      accept: '.pem,.crt,.cer,.der',
      icon: 'shield',
      readAs: 'buffer',
      onFiles: () => {},
      onBuffers: (buffers) => {
        const bytes = new Uint8Array(buffers[0])
        // A PEM file is ASCII; a DER file starts with the SEQUENCE tag.
        if (bytes[0] === 0x2d) {
          input.value = new TextDecoder().decode(bytes)
          run()
        } else {
          void show(bytes)
        }
      },
    })

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Certificate', icon: 'shield' },
          field(input, { label: 'Certificate' }),
          drop.root,
          error,
        ),
        actions(summary),
        output,
        note('Decoding happens in your browser. Certificates are never uploaded or validated against the network.'),
      ),
    )
  },
}

export default tool
