import {
  actions,
  button,
  copyRow,
  field,
  grid,
  kvList,
  note,
  panel,
  select,
  textField,
  toolLayout,
} from '../../core/components'
import type { Tool } from '../../core/types'
import { DEFAULT_ITERATIONS, derive, describeCost, PBKDF2_HASHES, Pbkdf2Error, randomSalt, type DeriveOptions, type Pbkdf2Hash } from './pbkdf2'

const tool: Tool = {
  slug: 'pbkdf2',
  name: 'PBKDF2 Key Derivation',
  description: 'Derive a key from a password and salt with PBKDF2, and inspect the resulting digest.',
  category: 'Security',
  keywords: ['pbkdf2', 'kdf', 'derive', 'key', 'password', 'salt', 'iterations', 'hash'],
  render(root) {
    const password = textField({ type: 'password', placeholder: 'Password…', onInput: () => run() })
    password.autocomplete = 'off'
    const salt = textField({ value: 'salt', mono: true, onInput: () => run() })
    const saltEncoding = select({
      options: ['utf8', 'hex', 'base64'].map((value) => ({ value, label: value })),
      value: 'utf8',
      onChange: () => run(),
    })
    const hash = select({
      options: PBKDF2_HASHES.map((value) => ({ value, label: value })),
      value: 'SHA-256',
      onChange: () => run(),
    })
    const iterations = textField({ type: 'number', value: String(DEFAULT_ITERATIONS), mono: true, onInput: () => run() })
    const length = textField({ type: 'number', value: '32', mono: true, onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    const cost = note('')
    const rows = kvList()
    let token = 0

    async function run() {
      const current = ++token
      try {
        const options: DeriveOptions = {
          iterations: Number(iterations.value) || DEFAULT_ITERATIONS,
          hash: hash.value as Pbkdf2Hash,
          length: Number(length.value) || 32,
          saltEncoding: saltEncoding.value as DeriveOptions['saltEncoding'],
        }
        cost.textContent = describeCost(options.iterations!)
        const result = await derive(password.value, salt.value, options)
        if (current !== token) return
        rows.replaceChildren(copyRow('Hex', result.hex), copyRow('Base64', result.base64))
        error.hidden = true
      } catch (err) {
        if (current !== token) return
        rows.replaceChildren()
        error.textContent = err instanceof Pbkdf2Error ? err.message : 'Could not derive a key with those inputs.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Inputs', icon: 'key' },
          field(password, { label: 'Password' }),
          grid(240, field(salt, { label: 'Salt' }), field(saltEncoding, { label: 'Salt encoding' })),
          actions(
            button('Random salt', {
              icon: 'refresh',
              onClick: () => {
                salt.value = randomSalt(16)
                saltEncoding.value = 'hex'
                run()
              },
            }),
          ),
        ),
        panel(
          { title: 'Derivation', icon: 'sliders' },
          grid(150, field(hash, { label: 'Hash' }), field(iterations, { label: 'Iterations' }), field(length, { label: 'Length (bytes)' })),
          cost,
          error,
        ),
        panel({ title: 'Derived key', icon: 'lock' }, rows),
              ),
    )

    run()
  },
}

export default tool
