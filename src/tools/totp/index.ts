import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { formatCode, generateTotp, hotp, base32Decode, otpauthUri, TotpError, type TotpAlgorithm } from './totp'

const tool: Tool = {
  slug: 'totp',
  name: 'TOTP / HOTP Generator',
  description: 'Generate time-based and counter-based one-time codes from a Base32 secret.',
  category: 'Security',
  keywords: ['totp', 'hotp', 'otp', '2fa', 'mfa', 'authenticator', 'rfc6238', 'base32', 'one-time'],
  render(root) {
    const secretInput = el('input', { class: 'ts-input ts-mono', type: 'text', value: 'JBSWY3DPEHPK3PXP', spellcheck: false, 'aria-label': 'Base32 secret' }) as HTMLInputElement
    const digitsSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const digits of [6, 7, 8]) digitsSelect.append(el('option', { value: String(digits), selected: digits === 6 }, `${digits} digits`))
    const periodSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const period of [30, 60]) periodSelect.append(el('option', { value: String(period), selected: period === 30 }, `${period}s`))
    const algorithmSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const algorithm of ['SHA-1', 'SHA-256', 'SHA-512'] as TotpAlgorithm[]) algorithmSelect.append(el('option', { value: algorithm }, algorithm))

    const codeDisplay = el('code', { class: 'ts-otp-code' })
    const progress = el('div', { class: 'ts-otp-progress-inner' })
    const remainingText = el('span', { class: 'ts-muted' })
    const error = el('p', { class: 'ts-error', hidden: true })

    const counterInput = el('input', { class: 'ts-input ts-mono', type: 'number', value: '0', min: '0', 'aria-label': 'HOTP counter' }) as HTMLInputElement
    const hotpOut = el('code', { class: 'ts-otp-inline' })

    const accountInput = el('input', { class: 'ts-input', type: 'text', value: '', spellcheck: false, placeholder: 'me@example.com' }) as HTMLInputElement
    const issuerInput = el('input', { class: 'ts-input', type: 'text', value: '', spellcheck: false, placeholder: 'Example' }) as HTMLInputElement
    const uriOut = el('pre', { class: 'ts-uri-out' })

    let timer: number | undefined
    let currentCode = ''

    function options() {
      return {
        digits: Number(digitsSelect.value),
        step: Number(periodSelect.value),
        algorithm: algorithmSelect.value as TotpAlgorithm,
      }
    }

    async function tick() {
      try {
        const result = await generateTotp(secretInput.value, options())
        currentCode = result.code
        codeDisplay.textContent = formatCode(result.code)
        remainingText.textContent = `${result.secondsRemaining}s left`
        progress.style.width = `${(result.secondsRemaining / result.period) * 100}%`
        error.hidden = true
        uriOut.textContent = otpauthUri(secretInput.value.replace(/\s/g, ''), accountInput.value, issuerInput.value, options())
      } catch (err) {
        codeDisplay.textContent = '------'
        progress.style.width = '0%'
        remainingText.textContent = ''
        uriOut.textContent = ''
        error.textContent = err instanceof TotpError ? err.message : 'Enter a Base32 secret.'
        error.hidden = false
      }
    }

    async function updateHotp() {
      try {
        const key = base32Decode(secretInput.value)
        hotpOut.textContent = await hotp(key, Number(counterInput.value) | 0, Number(digitsSelect.value), algorithmSelect.value as TotpAlgorithm)
      } catch {
        hotpOut.textContent = '—'
      }
    }

    function refresh() {
      void tick()
      void updateHotp()
    }

    for (const input of [secretInput, accountInput, issuerInput, counterInput]) input.addEventListener('input', refresh)
    for (const select of [digitsSelect, periodSelect, algorithmSelect]) select.addEventListener('change', refresh)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Base32 secret'), secretInput),
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Digits'), digitsSelect),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Period'), periodSelect),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Algorithm'), algorithmSelect),
        ),
        error,
        el(
          'div',
          { class: 'ts-otp-card' },
          codeDisplay,
          el('div', { class: 'ts-otp-progress' }, progress),
          el(
            'div',
            { class: 'ts-row ts-between' },
            remainingText,
            copyChip(() => formatCode(currentCode), 'Copy code'),
          ),
        ),
        el('h3', { class: 'ts-subhead' }, 'Counter-based (HOTP)'),
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Counter'), counterInput),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Code'), hotpOut, copyChip(() => hotpOut.textContent ?? '')),
        ),
        el('h3', { class: 'ts-subhead' }, 'otpauth:// URI'),
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Account'), accountInput),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Issuer'), issuerInput),
        ),
        uriOut,
        el('p', { class: 'ts-note' }, 'Secrets stay in this page. Codes are computed with the WebCrypto API in your browser and are never sent anywhere.'),
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
