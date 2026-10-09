import {
  actions,
  badge,
  cards,
  card,
  copyButton,
  dropzone,
  field,
  note,
  outputBlock,
  panel,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { detect, looksLikeText, parseHex, preview, toHex } from './magic'

const SAMPLE = '89 50 4e 47 0d 0a 1a 0a 00 00 00 0d 49 48 44 52'

const tool: Tool = {
  slug: 'magic-bytes',
  name: 'Magic Bytes Detector',
  description: 'Identify a file type from its leading bytes, or inspect a file header.',
  category: 'Media',
  keywords: ['magic bytes', 'file type', 'signature', 'mime', 'header', 'hex', 'detect'],
  render(root) {
    const hex = textarea({ rows: 3, value: SAMPLE, onInput: () => runHex() })
    const error = note('', 'danger')
    error.hidden = true
    const verdict = el('div', { class: 'ts-k-actions' })
    const list = cards()
    const ascii = outputBlock('', { label: 'As ASCII' })

    function run(bytes: Uint8Array) {
      error.hidden = true
      list.replaceChildren()
      verdict.replaceChildren()
      ascii.body.replaceChildren(preview(bytes))
      ascii.setMeta(`${bytes.length} bytes`)
      if (bytes.length === 0) return

      const matches = detect(bytes)
      const text = looksLikeText(bytes)
      verdict.append(
        badge(matches[0]?.name ?? (text ? 'Plain text' : 'Unknown'), matches.length ? 'accent' : 'neutral'),
        badge(text ? 'looks like text' : 'looks binary', 'neutral'),
      )

      if (matches.length === 0) {
        list.append(note('No known signature matched these bytes.'))
      }
      for (const match of matches) {
        list.append(
          card(
            { title: match.name, meta: match.mime },
            el('div', { class: 'ts-k-actions' }, badge(`.${match.extension || 'no extension'}`, 'neutral'), note(`${match.confidence} bytes pinned`)),
            actions(copyButton(match.mime, { label: 'Copy MIME', size: 'sm' })),
          ),
        )
      }
    }

    function runHex() {
      try {
        run(parseHex(hex.value))
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not read that hex.'
        error.hidden = false
      }
    }

    const drop = dropzone({
      label: 'Drop a file to read its header',
      hint: 'or choose one',
      icon: 'file',
      readAs: 'buffer',
      onFiles: () => {},
      onBuffers: (buffers) => {
        const head = new Uint8Array(buffers[0]).subarray(0, 512)
        hex.value = toHex(head, 32)
        run(head)
      },
    })

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Leading bytes', icon: 'hash' },
          field(hex, { label: 'Leading bytes as hex' }),
          drop.root,
          error,
        ),
        panel({ title: 'Detected', icon: 'search' }, verdict, list),
        ascii,
        note('Several formats share a prefix, so every match is listed with the number of bytes its signature pinned down. Reading the file stays on the machine.'),
      ),
    )

    runHex()
  },
}

export default tool
