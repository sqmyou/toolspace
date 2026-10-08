import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { isImage, isTextual, lookupByFilename, lookupByType, searchMime } from './mime'

const tool: Tool = {
  slug: 'mime-lookup',
  name: 'MIME Type Lookup',
  description: 'Find the MIME type for a file extension, or the extensions for a MIME type.',
  category: 'Web',
  keywords: ['mime', 'content type', 'media type', 'extension', 'file type', 'content-type'],
  render(root) {
    const filename = el('input', { class: 'ts-input', value: 'photo.png', placeholder: 'e.g. report.xlsx', 'aria-label': 'Filename' }) as HTMLInputElement
    const result = el('div', { class: 'ts-copy-list' })

    function runFilename() {
      const found = lookupByFilename(filename.value)
      if (!found.extension) {
        result.replaceChildren(el('p', { class: 'ts-muted' }, 'No file extension found.'))
        return
      }
      const badge = found.known ? el('span', { class: 'ts-badge ts-pass' }, 'known') : el('span', { class: 'ts-badge ts-fail' }, 'unknown')
      result.replaceChildren(
        el(
          'div',
          { class: 'ts-copy-row' },
          el('span', { class: 'ts-muted' }, `.${found.extension}`),
          el('code', { class: 'ts-mono ts-value' }, found.mime),
          copyChip(() => found.mime),
          badge,
        ),
        el('p', { class: 'ts-muted' }, `Category: ${isImage(found.mime) ? 'image' : isTextual(found.mime) ? 'text' : 'binary'}`),
      )
    }

    filename.addEventListener('input', runFilename)

    const typeInput = el('input', { class: 'ts-input ts-mono', value: 'image/jpeg', placeholder: 'e.g. application/pdf', 'aria-label': 'MIME type' }) as HTMLInputElement
    const typeResult = el('div', { class: 'ts-row ts-wrap' })
    function runType() {
      const extensions = lookupByType(typeInput.value)
      typeResult.replaceChildren(
        ...(extensions.length
          ? extensions.map((extension) => el('span', { class: 'ts-pill' }, `.${extension}`))
          : [el('span', { class: 'ts-muted' }, 'No extension known for this type.')]),
      )
    }
    typeInput.addEventListener('input', runType)

    const browse = el('input', { class: 'ts-input', placeholder: 'Filter the table…', 'aria-label': 'Filter' }) as HTMLInputElement
    const browseResult = el('div', { class: 'ts-mime-list' })
    function runBrowse() {
      const entries = searchMime(browse.value)
      browseResult.replaceChildren(
        ...entries.slice(0, 100).map((entry) =>
          el(
            'div',
            { class: 'ts-mime-row' },
            el('code', { class: 'ts-mono ts-value' }, entry.type),
            el('span', { class: 'ts-muted' }, entry.extensions.map((e) => `.${e}`).join(' ') || '—'),
            copyChip(() => entry.type),
          ),
        ),
      )
    }
    browse.addEventListener('input', runBrowse)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Look up by filename'), filename),
        result,
        el('div', { class: 'ts-field' }, el('label', {}, 'Look up by MIME type'), typeInput),
        typeResult,
        el('h3', { class: 'ts-subhead' }, 'Browse'),
        browse,
        browseResult,
        el('p', { class: 'ts-note' }, 'A curated table of common web types, resolved in your browser.'),
      ),
    )

    runFilename()
    runType()
    runBrowse()
  },
}

export default tool
