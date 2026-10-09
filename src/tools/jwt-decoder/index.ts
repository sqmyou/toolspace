import {
  badge,
  field,
  findings,
  findingRow,
  note,
  outputBlock,
  panel,
  textarea,
  textField,
  toolLayout,
  type Tone,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { analyzeClaims, decodeJwt, JwtError, verifyJwt, type DecodedJwt } from './jwt'

const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkYSBMb3ZlbGFjZSIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxODkzNDU2MDAwfQ.' +
  '2uUbpZ2x-cfydShrzm9fw1-gAyk5kZ7ImgMEK2yX1G8'

const LEVEL_TONES: Record<string, Tone> = { ok: 'ok', info: 'neutral', warning: 'warn', error: 'danger' }

const tool: Tool = {
  slug: 'jwt-decoder',
  name: 'JWT Decoder & Verifier',
  description: 'Decode a JSON Web Token, inspect its claims and verify its signature locally.',
  category: 'Security',
  keywords: ['jwt', 'json web token', 'decode', 'verify', 'signature', 'bearer', 'token', 'hs256', 'rs256'],
  render(root) {
    const input = textarea({ rows: 4, value: SAMPLE, placeholder: 'Paste a JWT (header.payload.signature)…', onInput: () => decode() })
    const secret = textField({ type: 'password', placeholder: 'Secret (HS) or PEM/JWK public key…', onInput: () => decode() })
    const error = note('', 'danger')
    error.hidden = true
    const claims = findings()
    const header = outputBlock('', { label: 'Header', copy: () => header.body.textContent ?? '' })
    const payload = outputBlock('', { label: 'Payload', copy: () => payload.body.textContent ?? '' })
    const verifyOut = el('div', { class: 'ts-k-actions' })
    let token = 0

    async function decode() {
      const current = ++token
      try {
        const decoded: DecodedJwt = decodeJwt(input.value)
        error.hidden = true
        header.body.replaceChildren(decoded.headerJson)
        header.setMeta('JSON')
        payload.body.replaceChildren(decoded.payloadJson)
        payload.setMeta('JSON')

        claims.replaceChildren(
          ...analyzeClaims(decoded.payload).map((item) =>
            findingRow({ status: item.level, tone: LEVEL_TONES[item.level] ?? 'neutral', name: 'claim', message: item.message }),
          ),
        )

        await runVerify(decoded, current)
      } catch (err) {
        if (current !== token) return
        header.body.replaceChildren('')
        payload.body.replaceChildren('')
        claims.replaceChildren()
        verifyOut.replaceChildren()
        error.textContent = err instanceof JwtError ? err.message : 'Could not decode this token.'
        error.hidden = false
      }
    }

    async function runVerify(decoded: DecodedJwt, current: number) {
      const algorithm = String(decoded.header.alg ?? '')
      if (!secret.value.trim()) {
        verifyOut.replaceChildren(badge(`Signature not checked — enter a key to verify this ${algorithm || 'token'}`, 'neutral'))
        return
      }
      try {
        const result = await verifyJwt(input.value, { key: secret.value })
        if (current !== token) return
        verifyOut.replaceChildren(
          badge(result.valid ? `Signature valid (${result.algorithm})` : `Signature invalid: ${result.reason ?? 'no match.'}`, result.valid ? 'ok' : 'danger'),
        )
      } catch (err) {
        if (current !== token) return
        verifyOut.replaceChildren(badge(err instanceof Error ? err.message : 'Could not verify.', 'warn'))
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Token', icon: 'key2' },
          field(input, { label: 'Token' }),
          field(secret, { label: 'Verification key' }),
          error,
          verifyOut,
        ),
        panel({ title: 'Claims', icon: 'shield' }, claims),
        el('div', { class: 'ts-k-split' }, header, payload),
        note('Decoding and verification happen in your browser. Your token and key are never uploaded.'),
      ),
    )

    decode()
  },
}

export default tool
