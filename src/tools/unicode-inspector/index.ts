import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { decodeHtml, encodeHtml, inspect } from './unicode'

const tool: Tool = {
  slug: 'unicode-inspector',
  name: 'Unicode & HTML Entity Inspector',
  description: 'Break text into code points and encode or decode HTML entities.',
  category: 'Text',
  keywords: ['unicode', 'codepoint', 'html entity', 'escape', 'emoji', 'utf-8'],
  render(root) {
    const input = el('textarea', {
      class: 'ts-textarea',
      rows: 2,
      placeholder: 'Type or paste text…',
      'aria-label': 'Text to inspect',
    }) as HTMLTextAreaElement

    const grid = el('div', { class: 'ts-unicode-grid' })
    const entities = el('div', { class: 'ts-copy-list' })

    function update() {
      const infos = inspect(input.value)
      grid.replaceChildren(
        ...infos.map((info) =>
          el(
            'div',
            { class: 'ts-unicode-cell' },
            el('span', { class: 'ts-unicode-glyph' }, info.char),
            el('span', { class: 'ts-mono ts-value' }, info.unicode),
            el('span', { class: 'ts-muted' }, `dec ${info.decimal}`),
            el('span', { class: 'ts-muted' }, `js ${info.js}`),
            el('span', { class: 'ts-muted' }, `html ${info.html}`),
            info.name ? el('span', { class: 'ts-hint' }, info.name) : null,
          ),
        ),
      )
      entities.replaceChildren(
        el(
          'div',
          { class: 'ts-copy-row' },
          el('span', { class: 'ts-muted' }, 'Encode'),
          copyChip(() => encodeHtml(input.value)),
        ),
        el(
          'div',
          { class: 'ts-copy-row' },
          el('span', { class: 'ts-muted' }, 'Decode'),
          copyChip(() => decodeHtml(input.value)),
        ),
      )
    }

    input.addEventListener('input', update)

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Text'), input),
        el('h3', { class: 'ts-subhead' }, 'HTML entities'),
        entities,
        el('h3', { class: 'ts-subhead' }, 'Code points'),
        grid,
        el('p', { class: 'ts-note' }, 'Inspection happens in your browser.'),
      ),
    )

    update()
  },
}

export default tool
