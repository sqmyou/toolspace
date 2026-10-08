import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import {
  alphabetSize,
  DEFAULT_OPTIONS,
  estimateStrength,
  generatePassword,
  PasswordError,
  type PasswordOptions,
} from './password'

/** A random float in [0, 1) backed by the browser CSPRNG. */
function secureRandom(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] / 0x100000000
}

/** Characters-per-second estimate for the strength meter's crack-time hint. */
const GUESSES_PER_SECOND = 1e10

function crackTime(bits: number): string {
  if (bits <= 0) return 'instantly'
  const seconds = 2 ** bits / GUESSES_PER_SECOND
  const units: [number, string][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [365, 'day'],
    [100, 'year'],
  ]
  let value = seconds
  let label = 'second'
  for (const [factor, name] of units) {
    if (value < factor) {
      label = name
      break
    }
    value /= factor
    label = name
  }
  if (value >= 1000) return 'centuries'
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${label}${rounded === 1 ? '' : 's'}`
}

const tool: Tool = {
  slug: 'password-generator',
  name: 'Password Generator',
  description: 'Create strong random passwords with a live strength estimate. Nothing is sent anywhere.',
  category: 'Security',
  keywords: ['password', 'random', 'secure', 'passphrase', 'generator', 'entropy'],
  render(root) {
    const options: PasswordOptions = { ...DEFAULT_OPTIONS }
    let avoidAmbiguous = false

    const output = el('input', {
      class: 'ts-output',
      readonly: true,
      spellcheck: false,
      'aria-label': 'Generated password',
    }) as HTMLInputElement

    const meterFill = el('div', { class: 'ts-meter-fill' })
    const meterLabel = el('span', { class: 'ts-muted' })
    const hint = el('p', { class: 'ts-hint' })

    const lengthInput = el('input', {
      type: 'range',
      min: '4',
      max: '128',
      value: String(options.length),
      oninput: (e: Event) => {
        options.length = Number((e.target as HTMLInputElement).value)
        lengthValue.textContent = String(options.length)
        run()
      },
    }) as HTMLInputElement
    const lengthValue = el('span', { class: 'ts-value' }, String(options.length))

    function checkbox(key: keyof PasswordOptions, label: string, desc: string) {
      return el(
        'label',
        { class: 'ts-check' },
        el('input', {
          type: 'checkbox',
          checked: options[key] as boolean,
          onchange: (e: Event) => {
            options[key] = (e.target as HTMLInputElement).checked as never
            run()
          },
        }),
        el('span', {}, el('strong', {}, label), el('small', {}, ` ${desc}`)),
      )
    }

    function run() {
      try {
        const password = generatePassword(options, { avoidAmbiguous, random: secureRandom })
        output.value = password
        const bits = estimateStrength(password, alphabetSize(options, avoidAmbiguous)).entropyBits
        const { score, label } = estimateStrength(password, alphabetSize(options, avoidAmbiguous))
        meterFill.style.width = `${(score / 4) * 100}%`
        meterFill.dataset.score = String(score)
        meterLabel.textContent = `${label} · ~${Math.round(bits)} bits of entropy`
        hint.textContent = `A machine guessing 10 billion times a second would need about ${crackTime(bits)}.`
        hint.hidden = false
      } catch (error) {
        output.value = ''
        meterFill.style.width = '0%'
        meterLabel.textContent = ''
        hint.textContent = error instanceof PasswordError ? error.message : 'Could not generate a password.'
        hint.hidden = false
      }
    }

    async function copy() {
      if (!output.value) return
      try {
        await navigator.clipboard.writeText(output.value)
        copyButton.textContent = 'Copied'
        setTimeout(() => (copyButton.textContent = 'Copy'), 1200)
      } catch {
        output.select()
      }
    }

    const copyButton = el('button', { class: 'ts-button', onclick: copy }, 'Copy')

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el(
          'div',
          { class: 'ts-field' },
          el('label', {}, 'Password'),
          el('div', { class: 'ts-row' }, output, copyButton),
        ),
        el(
          'div',
          { class: 'ts-meter', role: 'meter' },
          meterFill,
        ),
        el('div', { class: 'ts-row ts-between' }, meterLabel),
        hint,
        el(
          'div',
          { class: 'ts-field' },
          el('label', {}, 'Length ', lengthValue),
          lengthInput,
        ),
        el(
          'div',
          { class: 'ts-checkbox-grid' },
          checkbox('lowercase', 'Lowercase', 'a–z'),
          checkbox('uppercase', 'Uppercase', 'A–Z'),
          checkbox('digits', 'Digits', '0–9'),
          checkbox('symbols', 'Symbols', '!@#$…'),
        ),
        el(
          'label',
          { class: 'ts-check' },
          el('input', {
            type: 'checkbox',
            onchange: (e: Event) => {
              avoidAmbiguous = (e.target as HTMLInputElement).checked
              run()
            },
          }),
          el('span', {}, el('strong', {}, 'Avoid ambiguous characters'), el('small', {}, ' skips I, l, 1, O, 0, o')),
        ),
        el('button', { class: 'ts-button ts-primary', onclick: run }, 'Generate another'),
        el('p', { class: 'ts-note' }, 'Generated with your browser’s secure random number generator. Nothing leaves this page.'),
      ),
    )

    run()
  },
}

export default tool
