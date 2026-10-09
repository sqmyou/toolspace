import {
  actions,
  button,
  copyRow,
  dropzone,
  iconButton,
  note,
  panel,
  stat,
  stats,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import { download, readFileAsArrayBuffer } from '../../core/ui'
import type { Tool } from '../../core/types'
import { formatBytes } from '../image-converter/image'
import { mergePdfs, pdfInfo, PdfError } from './pdf'

interface Entry {
  file: File
  bytes: Uint8Array
  pageCount: number
  /** Page indexes to include, in order. Empty means "all pages". */
  selected: number[]
}

const tool: Tool = {
  slug: 'pdf-merger',
  name: 'PDF Merger',
  description: 'Combine several PDFs into one, reorder them and drop pages.',
  category: 'Documents',
  keywords: ['pdf', 'merge', 'combine', 'join', 'append', 'documents', 'pages'],
  render(root) {
    const entries: Entry[] = []
    let result: { blob: Blob; pages: number } | null = null

    const list = el('div', { class: 'ts-pdf-list' })
    const warning = note('', 'danger')
    warning.hidden = true
    const summary = stats()
    const resultRow = el('div', { class: 'ts-k-kvlist' })
    const downloadButton = button('Download merged PDF', { variant: 'primary', icon: 'download', disabled: true })

    function fail(message: string) {
      warning.textContent = message
      warning.hidden = false
    }

    /** Recompute the merged file so the download always matches the list. */
    function rebuild() {
      result = null
      downloadButton.disabled = true
      resultRow.replaceChildren()

      if (entries.length === 0) {
        summary.replaceChildren(
          stat({ label: 'Files', value: '0' }),
          stat({ label: 'Pages in', value: '0' }),
          stat({ label: 'Merged pages', value: '—' }),
        )
        return
      }
      try {
        const merged = mergePdfs(
          entries.map((entry) => ({
            bytes: entry.bytes,
            pages: entry.selected.length > 0 ? entry.selected : undefined,
          })),
        )
        const pages = pdfInfo(merged).pageCount
        result = { blob: new Blob([merged], { type: 'application/pdf' }), pages }
        downloadButton.disabled = false
        resultRow.replaceChildren(
          copyRow('Result', `${pages} ${pages === 1 ? 'page' : 'pages'} · ${formatBytes(merged.length)}`, { copy: false }),
        )
        summary.replaceChildren(
          stat({ label: 'Files', value: String(entries.length) }),
          stat({ label: 'Pages in', value: String(entries.reduce((sum, entry) => sum + entry.pageCount, 0)) }),
          stat({ label: 'Merged pages', value: String(pages) }),
        )
      } catch (error) {
        fail(error instanceof PdfError ? error.message : 'These files could not be merged.')
      }
    }

    function move(index: number, delta: number) {
      const target = index + delta
      if (target < 0 || target >= entries.length) return
      const [entry] = entries.splice(index, 1)
      entries.splice(target, 0, entry)
      renderList()
      rebuild()
    }

    function renderList() {
      list.replaceChildren()
      if (entries.length === 0) {
        list.append(el('p', { class: 'ts-k-hint' }, 'No files yet. Add two or more PDFs to combine them.'))
        return
      }
      entries.forEach((entry, index) => {
        const pageChips = el('div', { class: 'ts-pdf-pages' })
        const allOn = entry.selected.length === 0
        pageChips.append(
          button('All', {
            size: 'sm',
            variant: allOn ? 'primary' : 'default',
            title: 'Include every page',
            onClick: () => {
              entry.selected = []
              renderList()
              rebuild()
            },
          }),
        )
        for (let page = 0; page < entry.pageCount; page += 1) {
          const on = entry.selected.includes(page)
          pageChips.append(
            button(String(page + 1), {
              size: 'sm',
              variant: on ? 'primary' : 'default',
              title: `Toggle page ${page + 1}`,
              onClick: () => {
                // Coming from "All", the first pick starts a fresh selection
                // containing just that page rather than everything.
                const base = allOn ? [] : entry.selected
                entry.selected = base.includes(page)
                  ? base.filter((value) => value !== page)
                  : [...base, page].sort((a, b) => a - b)
                if (entry.selected.length === entry.pageCount) entry.selected = []
                renderList()
                rebuild()
              },
            }),
          )
        }

        list.append(
          el(
            'div',
            { class: 'ts-pdf-item' },
            el(
              'div',
              { class: 'ts-pdf-item-head' },
              el('span', { class: 'ts-pdf-index' }, String(index + 1)),
              el(
                'span',
                { class: 'ts-pdf-item-text' },
                el('span', { class: 'ts-pdf-name' }, entry.file.name),
                el('span', { class: 'ts-pdf-meta' }, `${entry.pageCount} ${entry.pageCount === 1 ? 'page' : 'pages'} · ${formatBytes(entry.file.size)}`),
              ),
              el(
                'span',
                { class: 'ts-pdf-item-actions' },
                iconButton('arrowUp', { label: 'Move up', size: 'sm', onClick: () => move(index, -1) }),
                iconButton('arrowDown', { label: 'Move down', size: 'sm', onClick: () => move(index, 1) }),
                iconButton('close', {
                  label: 'Remove',
                  size: 'sm',
                  onClick: () => {
                    entries.splice(index, 1)
                    renderList()
                    rebuild()
                  },
                }),
              ),
            ),
            pageChips,
          ),
        )
      })
    }

    function addFiles(files: FileList | File[]) {
      warning.hidden = true
      const incoming = [...files]
      void (async () => {
        for (const file of incoming) {
          if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            fail(`${file.name} is not a PDF.`)
            continue
          }
          try {
            const bytes = new Uint8Array(await readFileAsArrayBuffer(file))
            const info = pdfInfo(bytes)
            if (info.encrypted) {
              fail(`${file.name} is encrypted. Remove its password first, then try again.`)
              continue
            }
            if (info.pageCount === 0) {
              fail(`${file.name} has no readable pages.`)
              continue
            }
            entries.push({ file, bytes, pageCount: info.pageCount, selected: [] })
          } catch (error) {
            fail(
              error instanceof PdfError
                ? `${file.name}: ${error.message}`
                : `${file.name} could not be read as a PDF.`,
            )
          }
        }
        renderList()
        rebuild()
      })()
    }

    const drop = dropzone({
      label: 'Drop PDFs here',
      hint: 'two or more files',
      accept: 'application/pdf',
      multiple: true,
      icon: 'file',
      onFiles: (files) => addFiles(files),
    })

    downloadButton.addEventListener('click', () => {
      if (result) download('merged.pdf', result.blob)
    })

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'Add PDFs', icon: 'uploadCloud' }, drop.root, warning),
        panel({ title: 'Order and pages', icon: 'list' }, list),
        panel({ title: 'Result', icon: 'info' }, summary, resultRow, actions(downloadButton)),
        note(
          'Files are parsed and rewritten in this tab. Nothing is uploaded. Encrypted PDFs and files that use cross-reference streams are reported rather than merged.',
        ),
      ),
    )

    renderList()
    rebuild()
  },
}

export default tool
