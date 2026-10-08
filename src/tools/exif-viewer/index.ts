import { el } from '../../core/dom'
import { readFileAsArrayBuffer } from '../../core/ui'
import type { Tool } from '../../core/types'
import { ExifError, groupEntries, parseExif } from './exif'

const tool: Tool = {
  slug: 'exif-viewer',
  name: 'EXIF Viewer',
  description: 'Read camera, lens, exposure and GPS metadata from photos without uploading them.',
  category: 'Media',
  keywords: ['exif', 'metadata', 'photo', 'camera', 'gps', 'jpeg', 'png', 'tiff', 'webp'],
  render(root) {
    const input = el('input', { type: 'file', accept: 'image/*,.tif,.tiff', class: 'ts-input' }) as HTMLInputElement
    const drop = el('div', { class: 'ts-dropzone' }, 'Drop an image here, or choose a file.')
    const error = el('p', { class: 'ts-error', hidden: true })
    const summary = el('p', { class: 'ts-muted' })
    const output = el('div', { class: 'ts-exif-groups' })

    async function handleFile(file: File) {
      error.hidden = true
      output.replaceChildren()
      summary.textContent = ''
      try {
        const buffer = await readFileAsArrayBuffer(file)
        const result = parseExif(new Uint8Array(buffer))
        summary.textContent = `${file.name} — ${result.format.toUpperCase()}, ${result.byteOrder}-endian, ${result.entries.length} tags`
        for (const group of groupEntries(result.entries)) {
          const table = el('table', { class: 'ts-exif-table' })
          table.append(el('thead', {}, el('tr', {}, el('th', {}, group.group), el('th', {}, 'Value'))))
          const body = el('tbody')
          for (const entry of group.entries) {
            body.append(el('tr', {}, el('td', { class: 'ts-exif-key' }, entry.name), el('td', {}, entry.value)))
          }
          table.append(body)
          output.append(el('section', { class: 'ts-exif-section' }, el('h3', { class: 'ts-subhead' }, `${group.group} · ${group.entries.length}`), table))
        }
      } catch (err) {
        error.textContent = err instanceof ExifError ? err.message : 'Could not read EXIF data from that file.'
        error.hidden = false
      }
    }

    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (file) void handleFile(file)
    })

    for (const event of ['dragenter', 'dragover']) {
      drop.addEventListener(event, (e) => {
        e.preventDefault()
        drop.classList.add('ts-dropzone-active')
      })
    }
    for (const event of ['dragleave', 'drop']) {
      drop.addEventListener(event, (e) => {
        e.preventDefault()
        drop.classList.remove('ts-dropzone-active')
      })
    }
    drop.addEventListener('drop', (e) => {
      const file = (e as DragEvent).dataTransfer?.files?.[0]
      if (file) void handleFile(file)
    })

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Image'), input),
        drop,
        error,
        summary,
        output,
        el('p', { class: 'ts-note' }, 'The file is read in your browser with the File API. It is never uploaded.'),
      ),
    )
  },
}

export default tool
