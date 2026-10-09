import {
  actions,
  card,
  cards,
  copyButton,
  copyRow,
  panel,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { decodeHtml, encodeHtml, inspect } from './unicode'

const tool: Tool = {
  slug: 'unicode-inspector',
  name: 'Unicode & HTML Entity Inspector',
  description: 'Break text into code points and encode or decode HTML entities.',
  category: 'Text',
  keywords: ['unicode', 'codepoint', 'html entity', 'escape', 'emoji', 'utf-8'],
  render(root) {
    const input = textarea({ rows: 2, placeholder: 'Type or paste text…', onInput: () => update() })
    input.spellcheck = false
    const grid = cards()
    const entities = el('div', { class: 'ts-k-kvlist' })

    function update() {
      grid.replaceChildren(
        ...inspect(input.value).map((info) =>
          card(
            { title: info.unicode, meta: info.char || undefined },
            el('div', { class: 'ts-k-kvlist' }, copyRow('decimal', info.decimal, { copy: false }), copyRow('JS', info.js, { copy: false }), copyRow('HTML', info.html, { copy: false })),
            info.name ? el('p', { class: 'ts-k-hint' }, info.name) : el('span'),
          ),
        ),
      )
      entities.replaceChildren(
        copyRow('Encode', encodeHtml(input.value)),
        copyRow('Decode', decodeHtml(input.value)),
      )
    }

    root.append(
      toolLayout(
        {},
        panel({ title: 'Text', icon: 'text' }, input),
        panel({ title: 'HTML entities', icon: 'code' }, entities),
        panel({ title: 'Code points', icon: 'list' }, grid),
        actions(copyButton(() => encodeHtml(input.value), { label: 'Copy encoded' })),
      ),
    )

    update()
  },
}

export default tool
