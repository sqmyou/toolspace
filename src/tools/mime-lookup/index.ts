import {
  badge,
  copyRow,
  kvList,
  note,
  panel,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { isImage, isTextual, lookupByFilename, lookupByType, searchMime } from './mime'

const tool: Tool = {
  slug: 'mime-lookup',
  name: 'MIME Type Lookup',
  description: 'Find the MIME type for a file extension, or the extensions for a MIME type.',
  category: 'Web',
  keywords: ['mime', 'content type', 'media type', 'extension', 'file type', 'content-type'],
  render(root) {
    const filename = textField({ value: 'photo.png', placeholder: 'e.g. report.xlsx', onInput: () => runFilename() })
    const fileRows = kvList()

    function runFilename() {
      const found = lookupByFilename(filename.value)
      if (!found.extension) {
        fileRows.replaceChildren(note('No file extension found.'))
        return
      }
      fileRows.replaceChildren(
        copyRow(`.${found.extension}`, found.mime),
        el(
          'div',
          { class: 'ts-mime-meta' },
          badge(found.known ? 'known' : 'unknown', found.known ? 'ok' : 'danger'),
          el('span', { class: 'ts-k-hint' }, `Category: ${isImage(found.mime) ? 'image' : isTextual(found.mime) ? 'text' : 'binary'}`),
        ),
      )
    }

    const typeInput = textField({ value: 'image/jpeg', mono: true, placeholder: 'e.g. application/pdf', onInput: () => runType() })
    const typeRow = el('div', { class: 'ts-k-chips' })
    function runType() {
      const extensions = lookupByType(typeInput.value)
      typeRow.replaceChildren(
        ...(extensions.length
          ? extensions.map((extension) => badge(`.${extension}`))
          : [el('span', { class: 'ts-k-hint' }, 'No extension known for this type.')]),
      )
    }

    const browse = textField({ placeholder: 'Filter the table…', onInput: () => runBrowse() })
    const browseList = el('div', { class: 'ts-mime-list' })
    function runBrowse() {
      const entries = searchMime(browse.value)
      browseList.replaceChildren(
        ...entries.slice(0, 100).map((entry) =>
          el(
            'div',
            { class: 'ts-mime-row' },
            el('code', { class: 'ts-k-mono ts-mime-type' }, entry.type),
            el('span', { class: 'ts-k-hint' }, entry.extensions.map((extension) => `.${extension}`).join(' ') || '—'),
          ),
        ),
      )
    }

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'By filename', icon: 'file' }, filename, fileRows),
        panel({ title: 'By MIME type', icon: 'type' }, typeInput, typeRow),
        panel({ title: 'Browse', icon: 'filter' }, browse, browseList),
              ),
    )

    runFilename()
    runType()
    runBrowse()
  },
}

export default tool
