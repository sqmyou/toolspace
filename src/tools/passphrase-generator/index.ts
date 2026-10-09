import {
  actions,
  badge,
  button,
  copyRow,
  field,
  kvList,
  note,
  panel,
  slider,
  textField,
  toolLayout,
  checkbox,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { generateBatch, PassphraseError } from './passphrase'

const BATCH = 6

const tool: Tool = {
  slug: 'passphrase-generator',
  name: 'Passphrase Generator',
  description: 'Generate memorable multi-word passphrases with a clear entropy estimate.',
  category: 'Security',
  keywords: ['passphrase', 'password', 'diceware', 'entropy', 'random', 'words', 'memorable'],
  render(root) {
    let words = 4
    let capitalise = false
    let addNumber = false
    const separator = textField({ value: '-', onInput: () => run() })
    const error = note('', 'danger')
    error.hidden = true
    const strength = el('div', { class: 'ts-k-actions' })
    const list = kvList()

    const wordCount = slider({
      label: 'Words',
      min: 2,
      max: 10,
      value: 4,
      format: (value) => `${value} words`,
      onInput: (value) => {
        words = value
        run()
      },
    })

    function run() {
      list.replaceChildren()
      strength.replaceChildren()
      try {
        const batch = generateBatch(BATCH, { words, separator: separator.value || '-', capitalise, addNumber })
        list.replaceChildren(...batch.map((phrase, index) => copyRow(`#${index + 1}`, phrase.text)))
        const sample = batch[0]
        strength.append(
          badge(sample.strength, sample.strength === 'weak' ? 'danger' : sample.strength === 'fair' ? 'warn' : 'ok'),
          el('span', { class: 'ts-k-hint' }, `≈ ${sample.entropyBits.toFixed(0)} bits of entropy per passphrase`),
        )
        error.hidden = true
      } catch (err) {
        error.textContent = err instanceof PassphraseError ? err.message : 'Could not generate a passphrase.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Shape', icon: 'sliders' },
          wordCount,
          field(separator, { label: 'Separator' }),
          actions(
            checkbox({ label: 'Capitalise', onChange: (checked) => { capitalise = checked; run() } }),
            checkbox({ label: 'Add number', onChange: (checked) => { addNumber = checked; run() } }),
          ),
          error,
        ),
        panel(
          { title: 'Suggestions', icon: 'wand' },
          actions(button('Generate new set', { variant: 'primary', icon: 'refresh', onClick: run }), strength),
          list,
        ),
        note('Each word is drawn from a list of 400+ words using crypto.getRandomValues, so every phrase is equally likely. Six variants are shown at a time.'),
      ),
    )

    run()
  },
}

export default tool
