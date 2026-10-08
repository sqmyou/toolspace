import { el } from '../../core/dom'
import { copyChip, download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { generateLorem, type WordSource } from './lorem'

const tool: Tool = {
  slug: 'lorem-ipsum',
  name: 'Lorem Ipsum Generator',
  description: 'Generate placeholder text by words, sentences or paragraphs.',
  category: 'Text',
  keywords: ['lorem', 'ipsum', 'placeholder', 'dummy text', 'filler'],
  render(root) {
    let source: WordSource = 'classic'
    let unit: 'paragraphs' | 'sentences' | 'words' = 'paragraphs'

    const countInput = el('input', { class: 'ts-input', type: 'number', min: '1', max: '200', value: '3' }) as HTMLInputElement
    const opening = el('input', { type: 'checkbox', checked: true }) as HTMLInputElement

    const output = el('textarea', { class: 'ts-textarea', rows: 12, readonly: true }) as HTMLTextAreaElement

    const sourceSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    sourceSelect.append(el('option', { value: 'classic' }, 'Classic Latin'), el('option', { value: 'software' }, 'Software'))
    sourceSelect.addEventListener('change', () => {
      source = sourceSelect.value as WordSource
      generate()
    })

    const unitSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    unitSelect.append(
      el('option', { value: 'paragraphs' }, 'Paragraphs'),
      el('option', { value: 'sentences' }, 'Sentences'),
      el('option', { value: 'words' }, 'Words'),
    )
    unitSelect.addEventListener('change', () => {
      unit = unitSelect.value as typeof unit
      generate()
    })

    function generate() {
      output.value = generateLorem({
        source,
        unit,
        count: Number(countInput.value) || 1,
        classicOpening: opening.checked,
      })
    }

    countInput.addEventListener('input', generate)
    opening.addEventListener('change', generate)

    const actions = el(
      'div',
      { class: 'ts-row ts-wrap' },
      copyChip(() => output.value, 'Copy'),
      el('button', {
        class: 'ts-button',
        type: 'button',
        onclick: () => download('lorem-ipsum.txt', output.value),
      }, 'Download'),
      el('button', { class: 'ts-button', type: 'button', onclick: generate }, 'Regenerate'),
    )

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Source'), sourceSelect),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Unit'), unitSelect),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Count'), countInput),
          el('label', { class: 'ts-inline-field' }, opening, 'Start with “Lorem ipsum…”'),
        ),
        actions,
        el('div', { class: 'ts-field' }, output),
        el('p', { class: 'ts-note' }, 'Text is generated in your browser.'),
      ),
    )

    generate()
  },
}

export default tool
