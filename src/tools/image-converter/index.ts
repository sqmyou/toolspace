import {
  actions,
  button,
  checkbox,
  dropzone,
  field,
  mediaFrame,
  note,
  panel,
  select,
  slider,
  split,
  stat,
  stats,
  textField,
  toolLayout,
} from '../../core/components'
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

/** A frame with a caption above it, for side-by-side previews. */
function captioned(label: string, frame: HTMLElement): HTMLElement {
  return field(frame, { label })
}

const tool: Tool = {
  slug: 'image-converter',
  name: 'Image Converter',
  description: 'Resize and convert images to PNG, JPEG or WebP.',
  category: 'Media',
  keywords: ['image', 'convert', 'resize', 'png', 'jpeg', 'webp', 'compress', 'canvas'],
  render(root) {
    let source: { file: File; bitmap: ImageBitmap; width: number; height: number } | null = null
    let format: OutputFormat = 'image/webp'
    let qualityValue = 0.85
    let lastBlob: Blob | null = null
    let objectUrl = ''

    const status = note('Choose an image to begin.')
    const warning = note('', 'danger')
    warning.hidden = true

    const formatSelect = select({
      options: OUTPUT_FORMATS.map((spec) => ({ value: spec.mime, label: spec.label })),
      value: format,
      onChange: (value) => {
        format = value as OutputFormat
        syncQualityVisibility()
        void convert()
      },
    })

    const widthInput = textField({ type: 'number', placeholder: 'width' })
    const heightInput = textField({ type: 'number', placeholder: 'height' })
    const percentInput = textField({ type: 'number', value: '100', placeholder: '%' })
    const lockAspect = checkbox({ label: 'Lock aspect ratio', checked: true })
    const locked = () => (lockAspect.querySelector('input') as HTMLInputElement).checked

    const quality = slider({
      label: 'Quality',
      min: 10,
      max: 100,
      value: 85,
      format: (value) => `${value}%`,
      onInput: (value) => {
        qualityValue = value / 100
        void convert()
      },
    })

    const original = mediaFrame({ alt: 'Original', maxHeight: 300 })
    const converted = mediaFrame({ alt: 'Converted', maxHeight: 300, checker: true })
    const info = document.createElement('div')
    const emptyInfo = note('Converted size and saving appear here.')

    const downloadButton = button('Download', {
      variant: 'primary',
      icon: 'download',
      onClick: () => {
        if (lastBlob && source) download(outputName(source.file.name, format), lastBlob, format)
      },
    })
    downloadButton.disabled = true

    function targetDimensions(): Dimensions | null {
      if (!source) return null
      const width = parseDimensions(widthInput.value)
      const height = parseDimensions(heightInput.value)
      if (width && height) return { width, height }
      if (width) return locked() ? fitWithin(source, { width, height: Number.MAX_SAFE_INTEGER }) : { width, height: source.height }
      if (height) return locked() ? fitWithin(source, { width: Number.MAX_SAFE_INTEGER, height }) : { width: source.width, height }
      return scaleByPercent(source, parseDimensions(percentInput.value) ?? 100)
    }

    function syncQualityVisibility() {
      quality.hidden = !OUTPUT_FORMATS.find((item) => item.mime === format)?.supportsQuality
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

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, format, qualityValue))
      if (!blob) {
        warning.textContent = `This browser could not encode ${format}.`
        warning.hidden = false
        return
      }
      warning.hidden = true
      lastBlob = blob
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      objectUrl = URL.createObjectURL(blob)
      converted.image.src = objectUrl
      renderInfo(target, blob)
    }

    function renderInfo(target: Dimensions, blob: Blob) {
      if (!source) return
      const saved = 100 - (blob.size / source.file.size) * 100
      emptyInfo.hidden = true
      info.replaceChildren(
        stats(
          stat({ label: 'Original', value: `${source.width}×${source.height}`, hint: formatBytes(source.file.size) }),
          stat({ label: 'Output', value: `${target.width}×${target.height}`, hint: formatBytes(blob.size) }),
          stat({
            label: 'Change',
            value: `${saved >= 0 ? '−' : '+'}${Math.abs(saved).toFixed(1)}%`,
            hint: isSameAspect(source, target) ? 'same aspect' : 'aspect changed',
          }),
        ),
      )
      downloadButton.disabled = false
    }

    const picker = dropzone({
      label: 'Drop an image here',
      hint: 'or',
      accept: 'image/*',
      icon: 'image',
      onFiles: () => {},
      onBuffers: async (buffers, files) => {
        const file = files[0]
        const reason = rejectReason(file.type)
        if (reason) {
          warning.textContent = reason
          warning.hidden = false
          return
        }
        warning.hidden = true
        status.textContent = 'Decoding…'
        try {
          const bitmap = await createImageBitmap(new Blob([buffers[0]], { type: file.type }))
          source = { file, bitmap, width: bitmap.width, height: bitmap.height }
          original.image.src = URL.createObjectURL(file)
          widthInput.value = String(bitmap.width)
          heightInput.value = String(bitmap.height)
          status.textContent = `${file.name} · ${file.type}`
          await convert()
        } catch {
          warning.textContent = 'That image could not be decoded.'
          warning.hidden = false
          status.textContent = ''
        }
      },
    })

    for (const input of [widthInput, heightInput, percentInput, lockAspect]) {
      input.addEventListener('input', () => void convert())
    }

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'Source', icon: 'image' }, picker.root, status, warning),
        panel(
          { title: 'Output settings', icon: 'sliders' },
          field(formatSelect, { label: 'Format' }),
          quality,
          actions(
            field(widthInput, { label: 'Width', grow: true }),
            field(heightInput, { label: 'Height', grow: true }),
            field(percentInput, { label: 'Scale %', grow: true }),
          ),
          lockAspect,
        ),
        panel(
          { title: 'Preview', icon: 'eye' },
          split(captioned('Original', original.root), captioned('Converted', converted.root)),
        ),
        info,
        emptyInfo,
        actions(downloadButton),
              ),
    )

    syncQualityVisibility()
  },
}

export default tool
