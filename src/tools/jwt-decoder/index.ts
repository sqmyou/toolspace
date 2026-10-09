import {
  actions,
  badge,
  button,
  field,
  findings,
  findingRow,
  note,
  outputBlock,
  panel,
  segmented,
  textarea,
  textField,
  toolLayout,
  type Tone,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { analyzeClaims, decodeJwt, JwtError, signJwt, verifyJwt, type DecodedJwt } from './jwt'

const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkYSBMb3ZlbGFjZSIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxODkzNDU2MDAwfQ.' +
  '2uUbpZ2x-cfydShrzm9fw1-gAyk5kZ7ImgMEK2yX1G8'

const LEVEL_TONES: Record<string, Tone> = { ok: 'ok', info: 'neutral', warning: 'warn', error: 'danger' }

type SignAlg = 'HS256' | 'HS384' | 'HS512'

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
    let currentAlg: SignAlg = 'HS256'

    const signPayload = textarea({
      rows: 4,
      value: '{\n  "sub": "1234567890",\n  "name": "Ada Lovelace",\n  "iat": 1700000000\n}',
      placeholder: 'Payload as a JSON object…',
    })
    const signSecret = textField({ type: 'password', placeholder: 'Shared secret for HS256…' })
    const algorithm = segmented({
      label: 'Signing algorithm',
      value: 'HS256',
      items: [
        { value: 'HS256', label: 'HS256' },
        { value: 'HS384', label: 'HS384' },
        { value: 'HS512', label: 'HS512' },
      ],
      onChange: (value) => {
        currentAlg = value as SignAlg
      },
    })
    const signError = note('', 'danger')
    signError.hidden = true
    const signed = outputBlock('', { label: 'Signed token', copy: () => signed.body.textContent ?? '' })

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

    function signIt() {
      signError.hidden = true
      const raw = signPayload.value.trim()
      if (!raw) {
        signError.textContent = 'Enter the payload JSON to sign.'
        signError.hidden = false
        return
      }
      let parsed: Record<string, unknown>
      try {
        const value = JSON.parse(raw)
        if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object')
        parsed = value as Record<string, unknown>
      } catch {
        signError.textContent = 'The payload must be a JSON object, for example {"sub":"123"}.'
        signError.hidden = false
        return
      }
      if (!signSecret.value) {
        signError.textContent = 'Enter the shared secret to sign with.'
        signError.hidden = false
        return
      }
      void (async () => {
        const alg = currentAlg
        try {
          const jwt = await signJwt({ alg, typ: 'JWT' }, parsed, signSecret.value, alg)
          if (alg !== currentAlg) return
          signed.body.replaceChildren(jwt)
          signed.setMeta(`${alg} · ${jwt.length} chars`)
          verifyOut.replaceChildren(badge('Signature created.', 'ok'))
        } catch (err) {
          signError.textContent = err instanceof Error ? err.message : 'Could not sign this payload.'
          signError.hidden = false
        }
      })()
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
        panel(
          { title: 'Sign a token', icon: 'wand' },
          field(signPayload, { label: 'Payload (JSON)' }),
          el('div', { class: 'ts-k-split' }, field(signSecret, { label: 'Shared secret (HS)' }), field(algorithm, { label: 'Algorithm' })),
          signError,
          actions(button('Sign token', { icon: 'sparkle', variant: 'primary', onClick: signIt })),
          signed,
        ),
              ),
    )

    decode()
  },
}

export default tool
