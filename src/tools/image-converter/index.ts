import { el } from '../../core/dom'
import { download } from '../../core/ui'
import type { Tool } from '../../core/types'
import {
  OUTPUT_FORMATS,
  fitWithin,
  formatBytes,
  isSameAspect,
  outputName,
  parseDimensions,
  rejectReason,
  scaleByPercent,
  type Dimensions,
  type OutputFormat,
} from './image'

const tool: Tool = {
  slug: 'image-converter',
  name: 'Image Converter',
  description: 'Resize and convert images to PNG, JPEG or WebP entirely in your browser.',
  category: 'Media',
  keywords: ['image', 'convert', 'resize', 'png', 'jpeg', 'webp', 'compress', 'canvas'],
  render(root) {
    let source: { file: File; bitmap: ImageBitmap; width: number; height: number } | null = null
    let format: OutputFormat = 'image/webp'
    let quality = 0.85
    let lastBlob: Blob | null = null

    const fileInput = el('input', { type: 'file', accept: 'image/*' }) as HTMLInputElement
    const status = el('p', { class: 'ts-muted' })
    const warning = el('p', { class: 'ts-error', hidden: true })

    const formatSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    for (const spec of OUTPUT_FORMATS) formatSelect.append(el('option', { value: spec.mime }, spec.label))
    formatSelect.value = format

    const qualityRow = el('div', { class: 'ts-slider-field' })
    const qualityInput = el('input', { class: 'ts-range', type: 'range', min: '10', max: '100', value: '85' }) as HTMLInputElement
    const qualityReadout = el('span', { class: 'ts-mono ts-muted' }, '85%')
    qualityRow.append(el('label', {}, 'Quality'), qualityInput, qualityReadout)

    const widthInput = el('input', { class: 'ts-input', type: 'number', min: '1', placeholder: 'width' }) as HTMLInputElement
    const heightInput = el('input', { class: 'ts-input', type: 'number', min: '1', placeholder: 'height' }) as HTMLInputElement
    const lockAspect = el('input', { type: 'checkbox', checked: true }) as HTMLInputElement
    const percentInput = el('input', { class: 'ts-input', type: 'number', min: '1', max: '400', value: '100' }) as HTMLInputElement

    const originalPreview = el('img', { class: 'ts-image-preview', alt: 'Original' }) as HTMLImageElement
    const outputPreview = el('img', { class: 'ts-image-preview', alt: 'Converted' }) as HTMLImageElement
    const resultInfo = el('div', { class: 'ts-copy-list' })

    function targetDimensions(): Dimensions | null {
      if (!source) return null
      const width = parseDimensions(widthInput.value)
      const height = parseDimensions(heightInput.value)
      if (width && height) return { width, height }
      if (width) return lockAspect.checked ? fitWithin(source, { width, height: Number.MAX_SAFE_INTEGER }) : { width, height: source.height }
      if (height) return lockAspect.checked ? fitWithin(source, { width: Number.MAX_SAFE_INTEGER, height }) : { width: source.width, height }
      const percent = parseDimensions(percentInput.value) ?? 100
      const base = lockAspect.checked ? fitWithin(source, { width: source.width, height: source.height }) : source
      return scaleByPercent(base, percent)
    }

    function syncQualityVisibility() {
      const spec = OUTPUT_FORMATS.find((item) => item.mime === format)
      qualityRow.hidden = !spec?.supportsQuality
    }

    async function convert() {
      if (!source) return
      const target = targetDimensions()
      if (!target) return
      const canvas = document.createElement('canvas')
      canvas.width = target.width
      canvas.height = target.height
      const context = canvas.getContext('2d')
      if (!context) {
        warning.textContent = 'Could not get a 2D canvas context.'
        warning.hidden = false
        return
      }
      if (format === 'image/jpeg') {
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, target.width, target.height)
      }
      context.drawImage(source.bitmap, 0, 0, target.width, target.height)

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, format, quality))
      if (!blob) {
        warning.textContent = `This browser could not encode ${format}.`
        warning.hidden = false
        return
      }
      warning.hidden = true
      lastBlob = blob
      outputPreview.src = URL.createObjectURL(blob)
      renderInfo(target, blob)
    }

    function renderInfo(target: Dimensions, blob: Blob) {
      if (!source) return
      const saved = 100 - (blob.size / source.file.size) * 100
      const rows: [string, string][] = [
        ['Original', `${source.width}×${source.height} · ${formatBytes(source.file.size)}`],
        ['Output', `${target.width}×${target.height} · ${formatBytes(blob.size)}`],
        ['Aspect ratio', isSameAspect(source, target) ? 'unchanged' : 'changed'],
        ['Change', `${saved >= 0 ? '-' : '+'}${Math.abs(saved).toFixed(1)}% size`],
      ]
      resultInfo.replaceChildren(
        ...rows.map(([label, value]) =>
          el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, label), el('span', { class: 'ts-value' }, value)),
        ),
      )
    }

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]
      if (!file) return
      const reason = rejectReason(file.type)
      if (reason) {
        warning.textContent = reason
        warning.hidden = false
        return
      }
      warning.hidden = true
      status.textContent = 'Decoding…'
      try {
        const bitmap = await createImageBitmap(file)
        source = { file, bitmap, width: bitmap.width, height: bitmap.height }
        originalPreview.src = URL.createObjectURL(file)
        widthInput.value = String(bitmap.width)
        heightInput.value = String(bitmap.height)
        status.textContent = `${file.name} · ${file.type}`
        await convert()
      } catch {
        warning.textContent = 'That image could not be decoded.'
        warning.hidden = false
        status.textContent = ''
      }
    })

    formatSelect.addEventListener('change', () => {
      format = formatSelect.value as OutputFormat
      syncQualityVisibility()
      void convert()
    })
    qualityInput.addEventListener('input', () => {
      quality = Number(qualityInput.value) / 100
      qualityReadout.textContent = `${qualityInput.value}%`
      void convert()
    })
    for (const input of [widthInput, heightInput, percentInput, lockAspect]) {
      input.addEventListener('input', () => void convert())
    }

    const downloadButton = el('button', {
      class: 'ts-button ts-primary',
      type: 'button',
      onclick: () => {
        if (lastBlob && source) download(outputName(source.file.name, format), lastBlob, format)
      },
    }, 'Download')

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Image'), fileInput),
        status,
        warning,
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Format'), formatSelect),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Width'), widthInput),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Height'), heightInput),
          el('label', { class: 'ts-inline-field' }, lockAspect, 'Lock aspect ratio'),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Scale %'), percentInput),
        ),
        qualityRow,
        el('h3', { class: 'ts-subhead' }, 'Before / after'),
        el('div', { class: 'ts-two-col' },
          el('figure', { class: 'ts-image-figure' }, originalPreview, el('figcaption', { class: 'ts-muted' }, 'Original')),
          el('figure', { class: 'ts-image-figure' }, outputPreview, el('figcaption', { class: 'ts-muted' }, 'Converted')),
        ),
        resultInfo,
        downloadButton,
        el('p', { class: 'ts-note' }, 'Images are decoded, resized and re-encoded with canvas in your browser. Nothing is uploaded.'),
      ),
    )

    syncQualityVisibility()
  },
}

export default tool
