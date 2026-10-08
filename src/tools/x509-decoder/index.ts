import { el } from '../../core/dom'
import { copyChip, readFileAsArrayBuffer } from '../../core/ui'
import type { Tool } from '../../core/types'
import { fingerprints, parseCertificate, pemToDer, X509Error, type Certificate } from './x509'

const tool: Tool = {
  slug: 'x509-decoder',
  name: 'X.509 Certificate Decoder',
  description: 'Decode a PEM or DER certificate: subject, issuer, validity, key and extensions.',
  category: 'Security',
  keywords: ['x509', 'certificate', 'tls', 'ssl', 'pem', 'der', 'asn1', 'fingerprint', 'subject'],
  render(root) {
    const input = el('textarea', {
      class: 'ts-textarea ts-mono',
      rows: 8,
      spellcheck: false,
      placeholder: 'Paste a PEM certificate (-----BEGIN CERTIFICATE-----) or drop a .pem/.crt/.der file.',
    }) as HTMLTextAreaElement
    const fileInput = el('input', { type: 'file', accept: '.pem,.crt,.cer,.der', class: 'ts-input' }) as HTMLInputElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const output = el('div', { class: 'ts-x509' })
    let token = 0

    function row(label: string, value: string, copy = true) {
      return el(
        'div',
        { class: 'ts-x509-row' },
        el('span', { class: 'ts-muted' }, label),
        copy ? copyChip(value) : el('code', { class: 'ts-x509-value' }, value),
      )
    }

    function section(title: string, rows: HTMLElement[]): HTMLElement {
      return el('section', { class: 'ts-x509-section' }, el('h3', { class: 'ts-subhead' }, title), ...rows)
    }

    async function show(der: Uint8Array) {
      const current = ++token
      output.replaceChildren()
      try {
        const certificate: Certificate = parseCertificate(der)
        const prints = await fingerprints(der)
        if (current !== token) return

        const validity = `${certificate.notBefore.toISOString().slice(0, 10)} → ${certificate.notAfter.toISOString().slice(0, 10)}`
        const status = certificate.expired
          ? `expired ${Math.abs(certificate.daysRemaining)} days ago`
          : `${certificate.daysRemaining} days remaining`

        output.append(
          section('Certificate', [
            row('Subject', certificate.subject),
            row('Issuer', certificate.issuer),
            row('Serial number', certificate.serialNumber),
            row('Version', `v${certificate.version}`),
            row('Signature algorithm', certificate.signatureAlgorithm),
          ]),
          section('Validity', [
            row('Not before', certificate.notBefore.toISOString()),
            row('Not after', certificate.notAfter.toISOString()),
            row('Period', validity),
            el('p', { class: certificate.expired ? 'ts-x509-expired' : 'ts-x509-valid' }, certificate.expired ? `Expired — ${status}` : `Valid — ${status}`),
          ]),
          section('Public key', [
            row('Algorithm', certificate.publicKey.algorithm),
            ...(certificate.publicKey.curve ? [row('Curve', certificate.publicKey.curve)] : []),
            ...(certificate.publicKey.keySizeBits ? [row('Key size', `${certificate.publicKey.keySizeBits} bits`)] : []),
          ]),
          section('Extensions', [
            row('Basic constraints', certificate.basicConstraints ?? 'not present', false),
            row('CA', certificate.isCa ? 'yes' : 'no', false),
            row('Key usage', certificate.keyUsage.length ? certificate.keyUsage.join(', ') : 'not present', false),
            row('Extended key usage', certificate.extendedKeyUsage.length ? certificate.extendedKeyUsage.join(', ') : 'not present', false),
            row('Subject alternative names', certificate.subjectAltNames.length ? certificate.subjectAltNames.join('\n') : 'not present', false),
          ]),
          section('Fingerprints', [row('SHA-1', prints.sha1), row('SHA-256', prints.sha256)]),
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

    input.addEventListener('input', run)
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]
      if (!file) return
      const buffer = await readFileAsArrayBuffer(file)
      const bytes = new Uint8Array(buffer)
      // A PEM file is ASCII; a DER file starts with the SEQUENCE tag.
      if (bytes[0] === 0x2d) {
        const text = new TextDecoder().decode(bytes)
        input.value = text
        run()
      } else {
        await show(bytes)
      }
    })

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Certificate'), input),
        el('div', { class: 'ts-field' }, el('label', {}, 'Or open a file'), fileInput),
        error,
        output,
        el('p', { class: 'ts-note' }, 'Decoding happens in your browser. Certificates are never uploaded or validated against the network.'),
      ),
    )
  },
}

export default tool
