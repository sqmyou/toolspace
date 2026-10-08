import { el } from '../../core/dom'
import { copyChip, readFileAsArrayBuffer } from '../../core/ui'
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
    const hex = el('textarea', { class: 'ts-textarea ts-mono', rows: 3, spellcheck: false }, SAMPLE) as HTMLTextAreaElement
    const file = el('input', { class: 'ts-input', type: 'file' }) as HTMLInputElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const verdict = el('div', { class: 'ts-magic-verdict' })
    const list = el('div', { class: 'ts-magic-list' })
    const ascii = el('code', { class: 'ts-magic-ascii' })
    let detectedName = ''

    function run(bytes: Uint8Array) {
      error.hidden = true
      list.replaceChildren()
      verdict.replaceChildren()
      ascii.textContent = preview(bytes)
      if (bytes.length === 0) return

      const matches = detect(bytes)
      const text = looksLikeText(bytes)
      detectedName = matches[0]?.name ?? (text ? 'Plain text' : 'Unknown')

      verdict.append(el('span', { class: 'ts-magic-badge' }, detectedName), el('span', { class: 'ts-muted' }, text ? 'looks like text' : 'looks binary'))

      if (matches.length === 0) {
        list.append(el('p', { class: 'ts-muted' }, 'No known signature matched these bytes.'))
      }
      for (const match of matches) {
        list.append(
          el(
            'div',
            { class: 'ts-magic-row' },
            el('strong', {}, match.name),
            el('code', { class: 'ts-magic-value' }, match.mime),
            el('code', { class: 'ts-magic-value' }, match.extension ? `.${match.extension}` : 'no extension'),
            el('span', { class: 'ts-muted' }, `${match.confidence} bytes pinned`),
            copyChip(match.mime, 'Copy MIME'),
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

    hex.addEventListener('input', runHex)
    file.addEventListener('change', () => {
      const selected = file.files?.[0]
      if (!selected) return
      void (async () => {
        try {
          const data = new Uint8Array(await readFileAsArrayBuffer(selected))
          const head = data.subarray(0, 512)
          hex.value = toHex(head, 32)
          run(head)
        } catch (err) {
          error.textContent = err instanceof Error ? err.message : 'Could not read that file.'
          error.hidden = false
        }
      })()
    })

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Leading bytes as hex'), hex),
        el('div', { class: 'ts-field' }, el('label', {}, 'Or load a file'), file),
        error,
        verdict,
        el('div', { class: 'ts-field' }, el('label', {}, 'As ASCII'), ascii),
        list,
        el('p', { class: 'ts-note' }, 'Several formats share a prefix, so every match is listed with the number of bytes its signature pinned down. Reading the file stays on the machine.'),
      ),
    )

    runHex()
  },
}

export default tool
