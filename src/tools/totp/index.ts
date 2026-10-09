import {
  actions,
  badge,
  copyButton,
  copyRow,
  field,
  grid,
  kvList,
  note,
  outputBlock,
  panel,
  select,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { formatCode, generateTotp, hotp, base32Decode, otpauthUri, TotpError, type TotpAlgorithm } from './totp'

const tool: Tool = {
  slug: 'totp',
  name: 'TOTP / HOTP Generator',
  description: 'Generate time-based and counter-based one-time codes from a Base32 secret.',
  category: 'Security',
  keywords: ['totp', 'hotp', 'otp', '2fa', 'mfa', 'authenticator', 'rfc6238', 'base32', 'one-time'],
  render(root) {
    const secret = textField({ value: 'JBSWY3DPEHPK3PXP', mono: true, onInput: () => refresh() })
    const digits = select({
      options: [6, 7, 8].map((value) => ({ value: String(value), label: `${value} digits` })),
      value: '6',
      onChange: () => refresh(),
    })
    const period = select({
      options: [30, 60].map((value) => ({ value: String(value), label: `${value}s` })),
      value: '30',
      onChange: () => refresh(),
    })
    const algorithm = select({
      options: ['SHA-1', 'SHA-256', 'SHA-512'].map((value) => ({ value, label: value })),
      value: 'SHA-1',
      onChange: () => refresh(),
    })

    const code = el('code', { class: 'ts-otp-code' }, '------')
    const progress = el('div', { class: 'ts-otp-progress-inner' })
    const remaining = badge('—')
    const error = note('', 'danger')
    error.hidden = true

    const counter = textField({ type: 'number', value: '0', mono: true, onInput: () => refresh() })
    const hotpRow = kvList()

    const account = textField({ placeholder: 'me@example.com', onInput: () => refresh() })
    const issuer = textField({ placeholder: 'Example', onInput: () => refresh() })
    let uri = ''
    const uriOut = outputBlock('', { label: 'otpauth:// URI', copy: () => uri })

    let timer: number | undefined
    let currentCode = ''

    function options() {
      return {
        digits: Number(digits.value),
        step: Number(period.value),
        algorithm: algorithm.value as TotpAlgorithm,
      }
    }

    async function tick() {
      try {
        const result = await generateTotp(secret.value, options())
        currentCode = result.code
        code.textContent = formatCode(result.code)
        remaining.textContent = `${result.secondsRemaining}s left`
        remaining.className = `ts-k-badge ts-k-badge--${result.secondsRemaining > 5 ? 'ok' : 'warn'}`
        progress.style.width = `${(result.secondsRemaining / result.period) * 100}%`
        error.hidden = true
        uri = otpauthUri(secret.value.replace(/\s/g, ''), account.value, issuer.value, options())
        uriOut.body.replaceChildren(uri)
        uriOut.setMeta('')
      } catch (err) {
        currentCode = ''
        code.textContent = '------'
        progress.style.width = '0%'
        remaining.textContent = '—'
        uri = ''
        uriOut.body.replaceChildren('')
        uriOut.setMeta('')
        error.textContent = err instanceof TotpError ? err.message : 'Enter a Base32 secret.'
        error.hidden = false
      }
    }

    async function updateHotp() {
      try {
        const key = base32Decode(secret.value)
        const value = await hotp(key, Number(counter.value) | 0, Number(digits.value), algorithm.value as TotpAlgorithm)
        hotpRow.replaceChildren(copyRow('Code', value))
      } catch {
        hotpRow.replaceChildren(copyRow('Code', '—'))
      }
    }

    function refresh() {
      void tick()
      void updateHotp()
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Secret', icon: 'key' },
          field(secret, { label: 'Base32 secret' }),
          grid(150, field(digits, { label: 'Digits' }), field(period, { label: 'Period' }), field(algorithm, { label: 'Algorithm' })),
          error,
        ),
        panel(
          { title: 'Time-based code', icon: 'clock' },
          el('div', { class: 'ts-otp-card' }, code, el('div', { class: 'ts-otp-progress' }, progress)),
          actions(remaining, copyButton(() => formatCode(currentCode), { label: 'Copy code' })),
        ),
        panel({ title: 'Counter-based (HOTP)', icon: 'hash' }, field(counter, { label: 'Counter' }), hotpRow),
        panel({ title: 'Provisioning', icon: 'external' }, grid(220, field(account, { label: 'Account' }), field(issuer, { label: 'Issuer' })), uriOut),
        note('Secrets stay in this page. Codes are computed with the WebCrypto API in your browser and are never sent anywhere.'),
      ),
    )

    refresh()
    timer = window.setInterval(() => void tick(), 1000)
    window.addEventListener(
      'beforeunload',
      () => {
        if (timer !== undefined) window.clearInterval(timer)
      },
      { once: true },
    )
  },
}

export default tool
