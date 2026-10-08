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
  description: 'Combine several PDFs into one, reorder them and drop pages — entirely in your browser.',
  category: 'Documents',
  keywords: ['pdf', 'merge', 'combine', 'join', 'append', 'documents', 'pages'],
  render(root) {
    const entries: Entry[] = []
    let result: { blob: Blob; pages: number } | null = null

    const fileInput = el('input', { type: 'file', accept: 'application/pdf', multiple: true, class: 'ts-pdf-file' }) as HTMLInputElement
    const dropZone = el('div', { class: 'ts-pdf-drop' }, 'Drop PDFs here, or use the button above.')
    const list = el('div', { class: 'ts-pdf-list' })
    const warning = el('p', { class: 'ts-error', hidden: true })
    const summary = el('p', { class: 'ts-muted' }, 'No files yet.')
    const resultInfo = el('div', { class: 'ts-copy-list' })

    const downloadButton = el(
      'button',
      {
        type: 'button',
        class: 'ts-button ts-primary',
        disabled: true,
        onclick: () => {
          if (!result) return
          download('merged.pdf', result.blob)
        },
      },
      'Download merged PDF',
    ) as HTMLButtonElement

    function fail(message: string) {
      warning.textContent = message
      warning.hidden = false
    }

    function clearWarning() {
      warning.hidden = true
    }

    /** Recompute the merged file so the download always matches the list. */
    function rebuild() {
      result = null
      downloadButton.disabled = true
      resultInfo.replaceChildren()
      summary.textContent =
        entries.length === 0
          ? 'No files yet.'
          : `${entries.length} ${entries.length === 1 ? 'file' : 'files'} · ${entries.reduce((sum, entry) => sum + entry.pageCount, 0)} pages in total.`

      if (entries.length === 0) return
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
        resultInfo.append(
          el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, 'Merged'), el('span', { class: 'ts-value' }, `${pages} ${pages === 1 ? 'page' : 'pages'} · ${formatBytes(merged.length)}`)),
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
      entries.forEach((entry, index) => {
        const pageChips = el('div', { class: 'ts-pdf-pages' })
        const allOn = entry.selected.length === 0
        pageChips.append(
          el(
            'button',
            {
              type: 'button',
              class: `ts-pdf-page${allOn ? ' is-on' : ''}`,
              onclick: () => {
                entry.selected = []
                renderList()
                rebuild()
              },
            },
            'All',
          ),
        )
        for (let page = 0; page < entry.pageCount; page += 1) {
          const on = entry.selected.includes(page)
          pageChips.append(
            el(
              'button',
              {
                type: 'button',
                class: `ts-pdf-page${on ? ' is-on' : ''}`,
                title: `Toggle page ${page + 1}`,
                onclick: () => {
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
              },
              String(page + 1),
            ),
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
                el('button', { type: 'button', class: 'ts-icon-btn', title: 'Move up', disabled: index === 0, onclick: () => move(index, -1) }, '↑'),
                el('button', { type: 'button', class: 'ts-icon-btn', title: 'Move down', disabled: index === entries.length - 1, onclick: () => move(index, 1) }, '↓'),
                el(
                  'button',
                  {
                    type: 'button',
                    class: 'ts-icon-btn',
                    title: 'Remove',
                    onclick: () => {
                      entries.splice(index, 1)
                      renderList()
                      rebuild()
                    },
                  },
                  '✕',
                ),
              ),
            ),
            pageChips,
          ),
        )
      })
    }

    function addFiles(files: FileList | File[]) {
      clearWarning()
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

    fileInput.addEventListener('change', () => {
      if (fileInput.files) addFiles(fileInput.files)
      fileInput.value = ''
    })
    dropZone.addEventListener('dragover', (event) => {
      event.preventDefault()
      dropZone.classList.add('is-dragging')
    })
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('is-dragging'))
    dropZone.addEventListener('drop', (event) => {
      event.preventDefault()
      dropZone.classList.remove('is-dragging')
      if (event.dataTransfer?.files) addFiles(event.dataTransfer.files)
    })

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'PDF files'), el('div', { class: 'ts-tool-actions' }, fileInput)),
        dropZone,
        warning,
        list,
        summary,
        resultInfo,
        el('div', { class: 'ts-tool-actions' }, downloadButton),
        el(
          'p',
          { class: 'ts-note' },
          'Files are parsed and rewritten in this tab. Nothing is uploaded. Encrypted PDFs and files that use cross-reference streams are reported rather than merged.',
        ),
      ),
    )
  },
}

export default tool
