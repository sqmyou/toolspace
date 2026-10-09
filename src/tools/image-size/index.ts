import {
  actions,
  button,
  copyRow,
  dropzone,
  mediaFrame,
  note,
  panel,
  stat,
  stats,
  toolLayout,
} from '../../core/components'
import { download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { aspect, fitWithin, formatBytes, readDimensions } from './size'

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
    const error = note('', 'danger')
    error.hidden = true

    const details = document.createElement('div')
    details.className = 'ts-k-kvlist'
    const fits = document.createElement('div')
    fits.className = 'ts-k-grid'
    const frame = mediaFrame({ alt: 'Selected image', maxHeight: 260 })
    const caption = document.createElement('p')
    caption.className = 'ts-k-hint'

    const figures = stats()
    const previewPanel = panel({ title: 'Preview', icon: 'image' }, frame.root, caption)
    const detailPanel = panel({ title: 'Details', icon: 'ruler' }, details)
    const fitPanel = panel({ title: 'Fit within', icon: 'ruler' }, fits)
    const report = button('Download report', {
      icon: 'download',
      onClick: () => download('image-info.txt', details.textContent ?? ''),
    })
    const resultRow = document.createElement('div')
    resultRow.className = 'ts-k-split'
    resultRow.append(previewPanel, detailPanel)

    const picker = dropzone({
      label: 'Drop an image here',
      hint: 'PNG, JPEG, GIF, WebP, BMP, AVIF…',
      accept: 'image/*',
      icon: 'image',
      onFiles: () => {},
      onBuffers: ([buffer], files) => void load(buffer, files[0]),
    })

    /** Results only make sense once a file has been read. */
    function showResults(visible: boolean) {
      for (const node of [figures, resultRow, fitPanel, actionsRow]) node.hidden = !visible
    }

    const actionsRow = actions(report)

    async function load(buffer: ArrayBuffer, selected: File) {
      error.hidden = true
      showResults(false)
      const data = new Uint8Array(buffer)
      const info = readDimensions(data)
      if (!info) {
        error.textContent = 'That file does not look like an image this tool can read. The header was not recognised.'
        error.hidden = false
        return
      }

      const bytes = data.length
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
      details.replaceChildren(...rows.map(([label, value]) => copyRow(label, value)))

      figures.replaceChildren(
        stat({ label: 'Width', value: `${info.width}px` }),
        stat({ label: 'Height', value: `${info.height}px` }),
        stat({ label: 'Megapixels', value: ratio.megapixels.toFixed(2) }),
        stat({ label: 'File size', value: formatBytes(bytes) }),
      )

      frame.image.src = URL.createObjectURL(selected)
      frame.image.onload = () => URL.revokeObjectURL(frame.image.src)
      caption.textContent = selected.name

      fits.replaceChildren(
        ...TARGETS.map(([label, maxWidth, maxHeight]) => {
          const fit = fitWithin(info.width, info.height, maxWidth, maxHeight)
          const card = stat({ label, value: `${fit.width} × ${fit.height}`, hint: `from ${maxWidth} × ${maxHeight}` })
          card.classList.add('ts-k-stat--box')
          return card
        }),
      )

      showResults(true)
    }

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'Choose an image', icon: 'uploadCloud' }, picker.root, error),
        figures,
        resultRow,
        fitPanel,
        actionsRow,
        note('Only the file header is read. Dimensions come from the format header, not from decoding the image.'),
      ),
    )

    showResults(false)
  },
}

export default tool
