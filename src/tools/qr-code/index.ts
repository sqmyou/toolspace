import {
  actions,
  button,
  field,
  imageBlock,
  note,
  panel,
  select,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import { download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { buildMatrix, QrError, toCanvas, toSvg, type ErrorLevel, type QrMatrix } from './qr'

const LEVELS: ErrorLevel[] = ['L', 'M', 'Q', 'H']

const tool: Tool = {
  slug: 'qr-code',
  name: 'QR Code Generator',
  description: 'Generate a QR code offline and download it as SVG or PNG.',
  category: 'Data',
  keywords: ['qr', 'qrcode', 'barcode', 'encode', 'scan', 'svg', 'png'],
  render(root) {
    const input = textarea({
      rows: 4,
      value: 'https://toolspace.sirsamyoudev.workers.dev',
      placeholder: 'Text or URL to encode…',
      onInput: () => run(),
    })
    const error = note('', 'danger')
    error.hidden = true
    const preview = imageBlock({ title: 'Preview', icon: 'image', maxHeight: 320 })
    const svgButton = button('Download SVG', { icon: 'download', onClick: () => {
      if (matrix) download('qr-code.svg', toSvg(matrix, { margin: 2 }), 'image/svg+xml')
    } })
    const pngButton = button('Download PNG', { variant: 'primary', icon: 'download', onClick: () => {
      if (!matrix) return
      toCanvas(matrix, 1024, { margin: 2 }).toBlob((blob) => {
        if (blob) download('qr-code.png', blob, 'image/png')
      }, 'image/png')
    } })

    const level = select({
      value: 'M',
      options: LEVELS.map((value) => ({ value, label: value })),
      onChange: () => void run(),
    })

    let matrix: QrMatrix | null = null

    async function run() {
      try {
        const built = await buildMatrix(input.value, level.value as ErrorLevel)
        matrix = built
        preview.frame.replaceChildren(el('div', { class: 'ts-qr-frame', innerHTML: toSvg(built, { margin: 2 }) }))
        preview.caption.textContent = `${built.size}×${built.size} modules · error correction ${level.value}`
        error.hidden = true
        svgButton.disabled = false
        pngButton.disabled = false
      } catch (err) {
        matrix = null
        preview.frame.replaceChildren()
        preview.caption.textContent = ''
        error.textContent = err instanceof QrError ? err.message : 'Could not build this QR code.'
        error.hidden = false
        svgButton.disabled = true
        pngButton.disabled = true
      }
    }

    root.append(
      toolLayout(
        {},
        panel(
          { title: 'Content', icon: 'code' },
          field(input, { label: 'Content' }),
          field(level, { label: 'Error correction' }),
          error,
        ),
        preview.root,
        actions(svgButton, pngButton),
              ),
    )

    void run()
  },
}

export default tool
