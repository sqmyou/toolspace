import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { codePoints, decode, encode, namedEntities, stripTags } from './entities'

const tool: Tool = {
  slug: 'html-entities',
  name: 'HTML Entity Encoder',
  description: 'Escape and unescape HTML entities, with a character inspector for the result.',
  category: 'Web',
  keywords: ['html', 'entity', 'escape', 'unescape', 'entities', 'amp', 'nbsp', 'code point'],
  render(root) {
    const direction = el(
      'select',
      { class: 'ts-select' },
      el('option', { value: 'encode' }, 'Escape → Entities'),
      el('option', { value: 'decode' }, 'Entities → Text'),
    ) as HTMLSelectElement
    const quotes = el('input', { type: 'checkbox', checked: true }) as HTMLInputElement
    const all = el('input', { type: 'checkbox' }) as HTMLInputElement
    const strip = el('input', { type: 'checkbox' }) as HTMLInputElement
    const input = el('textarea', { class: 'ts-textarea ts-mono', rows: 6, spellcheck: false }, '<p class="note">Tom & Jerry</p>') as HTMLTextAreaElement
    const output = el('textarea', { class: 'ts-textarea ts-mono', rows: 6, spellcheck: false, readonly: true }) as HTMLTextAreaElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const inspector = el('div', { class: 'ts-entity-list' })
    const named = el('div', { class: 'ts-entity-list' })
    let result = ''

    function run() {
      try {
        result = direction.value === 'encode' ? encode(input.value, { quotes: quotes.checked, all: all.checked }) : decode(input.value)
        output.value = strip.checked && direction.value === 'decode' ? stripTags(input.value) : result
        error.hidden = true

        inspector.replaceChildren()
        for (const row of codePoints(result).slice(0, 200)) {
          inspector.append(
            el(
              'div',
              { class: 'ts-entity-row' },
              el('code', { class: 'ts-entity-char' }, row.char === ' ' ? '␠' : row.char),
              el('code', { class: 'ts-entity-code' }, `U+${row.codePoint.toString(16).toUpperCase().padStart(4, '0')}`),
              el('span', { class: 'ts-muted' }, row.entity),
            ),
          )
        }

        named.replaceChildren()
        const names = namedEntities(result)
        if (names.length === 0) named.append(el('p', { class: 'ts-muted' }, 'No named entities in the output.'))
        for (const row of names) named.append(el('div', { class: 'ts-entity-row' }, el('code', { class: 'ts-entity-char' }, row.char), el('span', { class: 'ts-muted' }, row.name), el('code', { class: 'ts-entity-code' }, row.entity)))
      } catch (err) {
        result = ''
        output.value = ''
        error.textContent = err instanceof Error ? err.message : 'Could not process that input.'
        error.hidden = false
      }
    }

    for (const node of [direction, quotes, all, strip]) node.addEventListener('change', run)
    input.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Direction'), direction),
          el('label', { class: 'ts-inline-field' }, quotes, 'Escape quotes'),
          el('label', { class: 'ts-inline-field' }, all, 'Escape all non-ASCII'),
          el('label', { class: 'ts-inline-field' }, strip, 'Strip tags when decoding'),
        ),
        el('div', { class: 'ts-field' }, el('label', {}, 'Input'), input),
        el('div', { class: 'ts-field' }, el('label', {}, 'Output'), output),
        error,
        copyChip(() => result, 'Copy output'),
        el('div', { class: 'ts-entity-columns' }, el('div', {}, el('h3', { class: 'ts-subhead' }, 'Characters'), inspector), el('div', {}, el('h3', { class: 'ts-subhead' }, 'Named entities'), named)),
        el('p', { class: 'ts-note' }, 'Only the characters that break HTML are escaped by default, so accented text stays readable. Decoding also understands &#169; and &#xA9; style references.'),
      ),
    )

    run()
  },
}

export default tool
