import {
  badge,
  dropzone,
  imageBlock,
  note,
  panel,
  stat,
  stats,
  table,
  toolLayout,
} from '../../core/components'
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
    const preview = imageBlock({ title: 'Photo', alt: 'Selected photo', maxHeight: 320 })
    const error = note('', 'danger')
    error.hidden = true
    const readout = stats()
    const meta = el('div', { class: 'ts-k-actions' })
    const groups = el('div', { class: 'ts-k-stack' })

    async function handleFile(file: File) {
      error.hidden = true
      groups.replaceChildren()
      readout.replaceChildren()
      meta.replaceChildren()
      preview.caption.textContent = ''
      try {
        const buffer = await readFileAsArrayBuffer(file)
        const result = parseExif(new Uint8Array(buffer))
        preview.image.src = URL.createObjectURL(file)
        preview.caption.textContent = file.name
        meta.replaceChildren(
          badge(result.format.toUpperCase(), 'accent'),
          badge(`${result.byteOrder}-endian`, 'neutral'),
          badge(`${result.entries.length} tags`, result.entries.length ? 'ok' : 'neutral'),
        )
        for (const group of groupEntries(result.entries)) {
          readout.append(stat({ label: group.group, value: String(group.entries.length) }))
          const rows = group.entries.map((entry) => ({ name: entry.name, value: entry.value }))
          groups.append(
            panel(
              { title: group.group, icon: 'camera', meta: `${group.entries.length} tags` },
              table(
                [
                  { key: 'name', label: 'Tag', mono: true },
                  { key: 'value', label: 'Value' },
                ],
                rows,
              ),
            ),
          )
        }
      } catch (err) {
        error.textContent = err instanceof ExifError ? err.message : 'Could not read EXIF data from that file.'
        error.hidden = false
      }
    }

    const drop = dropzone({
      label: 'Drop a photo here',
      hint: 'JPEG, PNG, WebP or TIFF',
      accept: 'image/*,.tif,.tiff',
      icon: 'image',
      onFiles: (files) => {
        if (files[0]) void handleFile(files[0])
      },
    })

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'Photo', icon: 'uploadCloud' }, drop.root, error),
        panel({ title: 'Summary', icon: 'info' }, readout, meta),
        preview.root,
        groups,
        note('The file is read in your browser with the File API. It is never uploaded.'),
      ),
    )
  },
}

export default tool
