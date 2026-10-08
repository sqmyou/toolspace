import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { analyzeClaims, decodeJwt, JwtError, verifyJwt, type DecodedJwt } from './jwt'

const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkYSBMb3ZlbGFjZSIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxODkzNDU2MDAwfQ.' +
  '2uUbpZ2x-cfydShrzm9fw1-gAyk5kZ7ImgMEK2yX1G8'

const tool: Tool = {
  slug: 'jwt-decoder',
  name: 'JWT Decoder & Verifier',
  description: 'Decode a JSON Web Token, inspect its claims and verify its signature locally.',
  category: 'Security',
  keywords: ['jwt', 'json web token', 'decode', 'verify', 'signature', 'bearer', 'token', 'hs256', 'rs256'],
  render(root) {
    const input = el('textarea', {
      class: 'ts-output ts-textarea',
      rows: 4,
      spellcheck: false,
      placeholder: 'Paste a JWT (header.payload.signature)…',
      value: SAMPLE,
    }) as HTMLTextAreaElement

    const secret = el('input', {
      class: 'ts-input ts-mono',
      type: 'password',
      spellcheck: false,
      placeholder: 'Secret (HS) or PEM/JWK public key…',
      'aria-label': 'Verification key',
    }) as HTMLInputElement

    const error = el('p', { class: 'ts-error', hidden: true })
    const claims = el('div', { class: 'ts-claims' })
    const segments = el('div', { class: 'ts-json-grid' })
    const verifyOut = el('div', { class: 'ts-verify-out' })

    function jsonBlock(label: string, json: string) {
      return el(
        'div',
        { class: 'ts-json-block' },
        el('div', { class: 'ts-json-head' }, el('span', {}, label), el('span', { class: 'ts-muted' }, 'JSON')),
        el('pre', { class: 'ts-pre' }, json),
      )
    }

    let token = 0

    async function decode() {
      const current = ++token
      try {
        const decoded: DecodedJwt = decodeJwt(input.value)
        error.hidden = true
        segments.replaceChildren(jsonBlock('Header', decoded.headerJson), jsonBlock('Payload', decoded.payloadJson))

        const notes = analyzeClaims(decoded.payload)
        claims.replaceChildren(
          ...notes.map((note) =>
            el('div', { class: `ts-claim ts-claim-${note.level}` }, el('span', { class: 'ts-claim-dot' }), note.message),
          ),
        )

        await runVerify(decoded, current)
      } catch (err) {
        if (current !== token) return
        segments.replaceChildren()
        claims.replaceChildren()
        verifyOut.replaceChildren()
        error.textContent = err instanceof JwtError ? err.message : 'Could not decode this token.'
        error.hidden = false
      }
    }

    async function runVerify(decoded: DecodedJwt, current: number) {
      const algorithm = String(decoded.header.alg ?? '')
      if (!secret.value.trim()) {
        verifyOut.replaceChildren(el('p', { class: 'ts-muted' }, `Signature not checked. Enter a key to verify this ${algorithm || 'token'}.`))
        return
      }
      try {
        const result = await verifyJwt(input.value, { key: secret.value })
        if (current !== token) return
        verifyOut.replaceChildren(
          el(
            'div',
            { class: `ts-claim ts-claim-${result.valid ? 'ok' : 'error'}` },
            el('span', { class: 'ts-claim-dot' }),
            result.valid ? `Signature valid (${result.algorithm}).` : `Signature invalid: ${result.reason ?? 'no match.'}`,
          ),
        )
      } catch (err) {
        if (current !== token) return
        verifyOut.replaceChildren(
          el('div', { class: 'ts-claim ts-claim-warning' }, el('span', { class: 'ts-claim-dot' }), err instanceof Error ? err.message : 'Could not verify.'),
        )
      }
    }

    input.addEventListener('input', decode)
    secret.addEventListener('input', decode)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Token'), input),
        el('div', { class: 'ts-field' }, el('label', {}, 'Verification key'), secret),
        error,
        claims,
        segments,
        verifyOut,
        el('p', { class: 'ts-note' }, 'Decoding and verification happen in your browser. Your token and key are never uploaded.'),
      ),
    )

    decode()
  },
}

export default tool
