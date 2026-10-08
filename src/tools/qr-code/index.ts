import { el } from '../../core/dom'
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
    const input = el('textarea', {
      class: 'ts-output ts-textarea',
      rows: 4,
      spellcheck: false,
      placeholder: 'Text or URL to encode…',
      value: 'https://toolspace.sirsamyoudev.workers.dev',
    }) as HTMLTextAreaElement

    const error = el('p', { class: 'ts-error', hidden: true })
    const preview = el('div', { class: 'ts-qr-preview' })
    const meta = el('p', { class: 'ts-muted' })

    let matrix: QrMatrix | null = null
    let level: ErrorLevel = 'M'

    function download(name: string, content: BlobPart, type: string) {
      const url = URL.createObjectURL(new Blob([content], { type }))
      el('a', { href: url, download: name }).click()
      URL.revokeObjectURL(url)
    }

    const svgButton = el(
      'button',
      {
        class: 'ts-button',
        onclick: () => {
          if (matrix) download('qr-code.svg', toSvg(matrix, { margin: 2 }), 'image/svg+xml')
        },
      },
      'Download SVG',
    )

    const pngButton = el(
      'button',
      {
        class: 'ts-button',
        onclick: () => {
          if (!matrix) return
          toCanvas(matrix, 1024, { margin: 2 }).toBlob((blob) => {
            if (blob) download('qr-code.png', blob, 'image/png')
          }, 'image/png')
        },
      },
      'Download PNG',
    )

    async function run() {
      try {
        const built = await buildMatrix(input.value, level)
        matrix = built
        preview.replaceChildren(el('div', { class: 'ts-qr-frame', innerHTML: toSvg(built, { margin: 2 }) }))
        meta.textContent = `${built.size}×${built.size} modules · error correction ${level}`
        error.hidden = true
        svgButton.disabled = false
        pngButton.disabled = false
      } catch (err) {
        matrix = null
        preview.replaceChildren()
        meta.textContent = ''
        error.textContent = err instanceof QrError ? err.message : 'Could not build this QR code.'
        error.hidden = false
        svgButton.disabled = true
        pngButton.disabled = true
      }
    }

    const levelNode = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const value of LEVELS) levelNode.append(el('option', { value, selected: value === level }, value))
    levelNode.addEventListener('change', () => {
      level = levelNode.value as ErrorLevel
      run()
    })

    input.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Content'), input),
        el('label', { class: 'ts-inline-field' }, el('span', {}, 'Error correction'), levelNode),
        error,
        preview,
        meta,
        el('div', { class: 'ts-row' }, svgButton, pngButton),
        el('p', { class: 'ts-note' }, 'Your text is encoded locally and never uploaded. The downloaded file has no tracking.'),
      ),
    )

    run()
  },
}

export default tool
