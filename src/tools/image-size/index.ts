import { el } from '../../core/dom'
import { copyChip, download, readFileAsArrayBuffer } from '../../core/ui'
import type { Tool } from '../../core/types'
import { aspect, fitWithin, formatBytes, readDimensions, type ImageDimensions } from './size'

const TARGETS: [string, number, number][] = [
  ['Full HD', 1920, 1080],
  ['Open Graph card', 1200, 630],
  ['Twitter card', 1200, 675],
  ['Retina thumb', 512, 512],
  ['Favicon', 256, 256],
]

const tool: Tool = {
  slug: 'image-size',
  name: 'Image Size Inspector',
  description: 'Read the dimensions and format of an image without uploading it.',
  category: 'Media',
  keywords: ['image', 'size', 'dimensions', 'width', 'height', 'aspect ratio', 'png', 'jpeg', 'webp', 'metadata'],
  render(root) {
    const file = el('input', { class: 'ts-input', type: 'file', accept: 'image/*' }) as HTMLInputElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const list = el('div', { class: 'ts-copy-list' })
    const preview = el('div', { class: 'ts-image-preview' })
    const fits = el('div', { class: 'ts-image-fits' })
    let info: ImageDimensions | null = null
    let bytes = 0

    function clear() {
      preview.replaceChildren()
      list.replaceChildren()
      fits.replaceChildren()
    }

    async function load(selected: File | undefined) {
      if (!selected) return
      clear()
      error.hidden = true
      try {
        const buffer = await readFileAsArrayBuffer(selected)
        const data = new Uint8Array(buffer)
        bytes = data.length
        info = readDimensions(data)
        if (!info) {
          error.textContent = 'That file does not look like an image this tool can read. The header was not recognised.'
          error.hidden = false
          return
        }

        const ratio = aspect(info.width, info.height)
        const rows: [string, string][] = [
          ['Width', `${info.width} px`],
          ['Height', `${info.height} px`],
          ['Format', info.format],
          ['MIME type', info.mime],
          ['Aspect ratio', ratio.ratio],
          ['Aspect (decimal)', ratio.decimal.toFixed(4)],
          ['Orientation', ratio.orientation],
          ['Megapixels', ratio.megapixels.toFixed(2)],
          ['File size', formatBytes(bytes)],
          ['Bytes per pixel', (bytes / (info.width * info.height)).toFixed(2)],
        ]
        for (const [label, value] of rows) list.append(el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted ts-image-name' }, label), el('code', { class: 'ts-image-value' }, value), copyChip(value, 'Copy')))

        const url = URL.createObjectURL(selected)
        const image = el('img', { class: 'ts-image-thumb', alt: selected.name }) as HTMLImageElement
        image.src = url
        image.addEventListener('load', () => URL.revokeObjectURL(url), { once: true })
        preview.append(image, el('p', { class: 'ts-muted' }, selected.name))

        for (const [label, maxWidth, maxHeight] of TARGETS) {
          const fit = fitWithin(info.width, info.height, maxWidth, maxHeight)
          fits.append(el('div', { class: 'ts-image-fit' }, el('strong', {}, label), el('code', { class: 'ts-image-value' }, `${fit.width} × ${fit.height}`), el('span', { class: 'ts-muted' }, `from ${maxWidth} × ${maxHeight}`)))
        }
      } catch (err) {
        error.textContent = err instanceof Error ? err.message : 'Could not read that file.'
        error.hidden = false
      }
    }

    file.addEventListener('change', () => void load(file.files?.[0]))

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Image file'), file),
        error,
        el('div', { class: 'ts-row ts-wrap ts-image-top' }, preview, list),
        el('h3', { class: 'ts-subhead' }, 'Fit within'),
        fits,
        el('div', { class: 'ts-row ts-wrap' }, el('button', { class: 'ts-button', type: 'button', onclick: () => { if (info) download('image-info.txt', list.textContent ?? '') } }, 'Download report')),
        el('p', { class: 'ts-note' }, 'Only the file header is read, so nothing is uploaded and large files stay on the machine. Dimensions come from the format header, not from decoding the image.'),
      ),
    )
  },
}

export default tool
