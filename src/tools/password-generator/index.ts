import {
  actions,
  badge,
  button,
  checkbox,
  copyButton,
  grid,
  meter,
  note,
  outputBlock,
  panel,
  slider,
  toolLayout,
} from '../../core/components'
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
    let password = ''
    const strength = meter()
    const label = badge('—')
    const hint = note('')
    const output = outputBlock('', { label: 'Password', copy: () => password })

    const length = slider({
      label: 'Length',
      min: 4,
      max: 128,
      value: options.length,
      onInput: (value) => {
        options.length = value
        run()
      },
    })

    function toggle(key: keyof PasswordOptions, text: string, desc: string) {
      return checkbox({
        label: text,
        hint: desc,
        checked: options[key] as boolean,
        onChange: (checked) => {
          options[key] = checked as never
          run()
        },
      })
    }

    function run() {
      try {
        password = generatePassword(options, { avoidAmbiguous, random: secureRandom })
        const size = alphabetSize(options, avoidAmbiguous)
        const estimate = estimateStrength(password, size)
        strength.set(estimate.score, estimate.score / 4)
        label.textContent = estimate.label
        label.className = `ts-k-badge ts-k-badge--${estimate.score >= 3 ? 'ok' : estimate.score >= 2 ? 'warn' : 'danger'}`
        hint.textContent = `${Math.round(estimate.entropyBits)} bits of entropy. A machine guessing 10 billion times a second would need about ${crackTime(estimate.entropyBits)}.`
        output.body.replaceChildren(password)
        output.setMeta(`${password.length} characters`)
        hint.hidden = false
      } catch (error) {
        password = ''
        strength.set(0, 0)
        label.textContent = '—'
        hint.textContent = error instanceof PasswordError ? error.message : 'Could not generate a password.'
        output.body.replaceChildren('')
        output.setMeta('')
        hint.hidden = false
      }
    }

    root.append(
      toolLayout(
        {},
        output,
        actions(strength.root, label),
        hint,
        panel(
          { title: 'Rules', icon: 'sliders' },
          length,
          grid(180,
            toggle('lowercase', 'Lowercase', 'a–z'),
            toggle('uppercase', 'Uppercase', 'A–Z'),
            toggle('digits', 'Digits', '0–9'),
            toggle('symbols', 'Symbols', '!@#$…'),
          ),
          actions(
            checkbox({
              label: 'Avoid ambiguous characters',
              hint: 'skips I, l, 1, O, 0, o',
              onChange: (checked) => {
                avoidAmbiguous = checked
                run()
              },
            }),
          ),
        ),
        actions(
          button('Generate another', { variant: 'primary', icon: 'refresh', onClick: run }),
          copyButton(() => password, { label: 'Copy' }),
        ),
        note('Generated with your browser’s secure random number generator. Nothing leaves this page.'),
      ),
    )

    run()
  },
}

export default tool
