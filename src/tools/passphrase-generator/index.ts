import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
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
    const countInput = el('input', { type: 'range', min: '2', max: '10', value: '4' }) as HTMLInputElement
    const countLabel = el('span', { class: 'ts-pass-count' }, '4 words')
    const separatorInput = el('input', { class: 'ts-input', type: 'text', value: '-', maxlength: '3', 'aria-label': 'Separator' }) as HTMLInputElement
    const capitalise = el('input', { type: 'checkbox' }) as HTMLInputElement
    const addNumber = el('input', { type: 'checkbox' }) as HTMLInputElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const list = el('div', { class: 'ts-copy-list' })
    const strength = el('div', { class: 'ts-pass-strength' })

    function run() {
      list.replaceChildren()
      strength.replaceChildren()
      try {
        const options = {
          words: Number(countInput.value),
          separator: separatorInput.value || '-',
          capitalise: capitalise.checked,
          addNumber: addNumber.checked,
        }
        countLabel.textContent = `${options.words} words`
        const batch = generateBatch(BATCH, options)
        for (const phrase of batch) {
          list.append(el('div', { class: 'ts-copy-row' }, copyChip(phrase.text)))
        }
        const sample = batch[0]
        strength.append(
          el('span', { class: `ts-pass-badge ts-pass-${sample.strength}` }, sample.strength),
          el('span', { class: 'ts-muted' }, `≈ ${sample.entropyBits.toFixed(0)} bits of entropy per passphrase`),
        )
        error.hidden = true
      } catch (err) {
        error.textContent = err instanceof PassphraseError ? err.message : 'Could not generate a passphrase.'
        error.hidden = false
      }
    }

    const regenerate = el('button', { class: 'ts-button', type: 'button', onclick: run }, 'Generate new set')
    countInput.addEventListener('input', run)
    separatorInput.addEventListener('input', run)
    capitalise.addEventListener('change', run)
    addNumber.addEventListener('change', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Words'), countInput, countLabel),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Separator'), separatorInput),
          el('label', { class: 'ts-inline-field' }, capitalise, 'Capitalise'),
          el('label', { class: 'ts-inline-field' }, addNumber, 'Add number'),
          regenerate,
        ),
        error,
        strength,
        list,
        el('p', { class: 'ts-note' }, `Each word is drawn from a list of 400+ words using crypto.getRandomValues, so every phrase is equally likely. Six variants are shown at a time.`),
      ),
    )

    run()
  },
}

export default tool
