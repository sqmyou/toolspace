import { el } from '../../core/dom'
import { download, readFileAsArrayBuffer } from '../../core/ui'
import type { Tool } from '../../core/types'
import { formatBytes, rejectReason } from '../image-converter/image'
import {
  cropOffset,
  MODE_HINTS,
  percentBox,
  presetById,
  presetsInGroup,
  resizeFilename,
  targetBox,
  type Dimensions,
  type Preset,
  type ResizeMode,
} from './resize'

const GROUPS: Preset['group'][] = ['Social', 'Web', 'Video']

/** Output encoders offered. PNG for screenshots, JPEG/WebP for photos. */
const FORMATS = [
  { mime: 'image/png', label: 'PNG', extension: 'png', quality: false },
  { mime: 'image/jpeg', label: 'JPEG', extension: 'jpg', quality: true },
  { mime: 'image/webp', label: 'WebP', extension: 'webp', quality: true },
] as const

const tool: Tool = {
  slug: 'image-resizer',
  name: 'Image Resizer',
  description: 'Resize an image to a preset, an exact size or a percentage — cropped, padded or stretched, all offline.',
  category: 'Media',
  keywords: ['resize', 'scale', 'image', 'dimensions', 'crop', 'instagram', 'thumbnail', 'preset', 'canvas'],
  render(root) {
    let source: { file: File; bitmap: ImageBitmap; width: number; height: number } | null = null
    let lastBlob: Blob | null = null
    let objectUrl = ''

    let mode: ResizeMode = 'fit'
    let formatIndex = 2 // WebP
    let quality = 0.9
    let activePreset = 'ig-square'

    const fileInput = el('input', { type: 'file', accept: 'image/*', class: 'ts-resize-file' }) as HTMLInputElement
    const status = el('p', { class: 'ts-muted' }, 'Choose an image, or drop one anywhere on this panel.')
    const warning = el('p', { class: 'ts-error', hidden: true })

    const stage = el('div', { class: 'ts-resize-stage' })
    const beforeImage = el('img', { class: 'ts-resize-preview', alt: 'Original' }) as HTMLImageElement
    const afterImage = el('img', { class: 'ts-resize-preview', alt: 'Resized' }) as HTMLImageElement
    const beforeCaption = el('figcaption', {}, 'Original')
    const afterCaption = el('figcaption', {}, 'Resized')

    const widthInput = el('input', { class: 'ts-input', type: 'number', min: '1', placeholder: 'width' }) as HTMLInputElement
    const heightInput = el('input', { class: 'ts-input', type: 'number', min: '1', placeholder: 'height' }) as HTMLInputElement
    const percentInput = el('input', { class: 'ts-range', type: 'range', min: '10', max: '200', value: '100' }) as HTMLInputElement
    const percentReadout = el('span', { class: 'ts-mono ts-muted' }, '100%')
    const lockAspect = el('input', { type: 'checkbox', checked: true }) as HTMLInputElement
    const formatSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    const qualityRow = el('div', { class: 'ts-slider-field' })
    const qualityInput = el('input', { class: 'ts-range', type: 'range', min: '10', max: '100', value: '90' }) as HTMLInputElement
    const qualityReadout = el('span', { class: 'ts-mono ts-muted' }, '90%')
    const resultInfo = el('div', { class: 'ts-copy-list' })
    const modeBar = el('div', { class: 'ts-mode-bar', role: 'radiogroup', 'aria-label': 'Resize mode' })
    const modeHint = el('p', { class: 'ts-hint' }, MODE_HINTS[mode])
    const presetBar = el('div', { class: 'ts-preset-bar' })
    const customFields = el('div', { class: 'ts-resize-custom' })

    for (const format of FORMATS) formatSelect.append(el('option', { value: format.mime }, format.label))
    formatSelect.value = FORMATS[formatIndex].mime

    const context = document.createElement('canvas').getContext('2d')

    function fail(message: string) {
      warning.textContent = message
      warning.hidden = false
    }

    /** The box the user is asking for, from preset, explicit size or percent. */
    function requestedBox(): Dimensions | null {
      if (!source) return null
      const width = Number(widthInput.value) || 0
      const height = Number(heightInput.value) || 0
      if (width > 0 && height > 0) return { width: Math.floor(width), height: Math.floor(height) }
      if (width > 0) {
        return lockAspect.checked
          ? { width: Math.floor(width), height: Math.max(1, Math.round((width / source.width) * source.height)) }
          : { width: Math.floor(width), height: source.height }
      }
      if (height > 0) {
        return lockAspect.checked
          ? { width: Math.max(1, Math.round((height / source.height) * source.width)), height: Math.floor(height) }
          : { width: source.width, height: Math.floor(height) }
      }
      const preset = presetById(activePreset)
      if (preset) return { width: preset.width, height: preset.height }
      return percentBox(source, Number(percentInput.value) || 100)
    }

    function selectedFormat() {
      return FORMATS.find((format) => format.mime === formatSelect.value) ?? FORMATS[2]
    }

    /** Draw the source onto a canvas at the requested box and return the blob. */
    async function draw(): Promise<{ blob: Blob; box: Dimensions } | null> {
      if (!source || !context) return null
      const box = requestedBox()
      if (!box) return null

      const canvas = context.canvas
      canvas.width = box.width
      canvas.height = box.height
      context.clearRect(0, 0, box.width, box.height)

      const format = selectedFormat()
      // JPEG has no alpha, so paint white underneath instead of black.
      if (format.mime === 'image/jpeg') {
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, box.width, box.height)
      }

      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'

      if (mode === 'fill') {
        const drawn = targetBox(source, box, 'fill')
        const offset = cropOffset(drawn, box)
        context.drawImage(source.bitmap, offset.x, offset.y, drawn.width, drawn.height)
      } else {
        const drawn = targetBox(source, box, mode)
        context.drawImage(source.bitmap, 0, 0, drawn.width, drawn.height)
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, format.mime, format.quality ? quality : undefined),
      )
      return blob ? { blob, box } : null
    }

    async function refresh() {
      if (!source) return
      const box = requestedBox()
      if (box) afterCaption.textContent = `Resized · ${box.width}×${box.height}`

      const drawn = await draw()
      if (!drawn) {
        lastBlob = null
        return
      }
      lastBlob = drawn.blob
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      objectUrl = URL.createObjectURL(drawn.blob)
      afterImage.src = objectUrl

      const format = selectedFormat()
      resultInfo.replaceChildren(
        el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, 'Original'), el('span', { class: 'ts-value' }, `${source.width}×${source.height} · ${formatBytes(source.file.size)}`)),
        el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, 'Resized'), el('span', { class: 'ts-value' }, `${drawn.box.width}×${drawn.box.height} · ${formatBytes(drawn.blob.size)}`)),
      )
      status.textContent = `${source.file.name} — ready as ${format.label}`
    }

    function renderModes() {
      modeBar.replaceChildren(
        ...(['fit', 'fill', 'stretch'] as ResizeMode[]).map((value) => {
          const on = mode === value
          const button = el(
            'button',
            {
              type: 'button',
              class: 'ts-mode-btn',
              role: 'radio',
              'aria-checked': on ? 'true' : 'false',
              title: MODE_HINTS[value],
              onclick: () => {
                mode = value
                modeHint.textContent = MODE_HINTS[value]
                renderModes()
                void refresh()
              },
            },
            value === 'fit' ? 'Fit' : value === 'fill' ? 'Fill' : 'Stretch',
          )
          if (on) button.classList.add('is-on')
          return button
        }),
      )
    }

    function renderPresets() {
      presetBar.replaceChildren()
      for (const group of GROUPS) {
        presetBar.append(el('span', { class: 'ts-preset-group' }, group))
        const row = el('div', { class: 'ts-preset-row' })
        for (const preset of presetsInGroup(group)) {
          const on = preset.id === activePreset
          const button = el(
            'button',
            {
              type: 'button',
              class: 'ts-preset',
              title: `${preset.width}×${preset.height}`,
              onclick: () => {
                activePreset = preset.id
                widthInput.value = String(preset.width)
                heightInput.value = String(preset.height)
                renderPresets()
                void refresh()
              },
            },
            el('span', { class: 'ts-preset-label' }, preset.label),
            el('span', { class: 'ts-preset-dim' }, `${preset.width}×${preset.height}`),
          )
          if (on) button.classList.add('is-on')
          row.append(button)
        }
        presetBar.append(row)
      }
    }

    function load(file: File) {
      warning.hidden = true
      const reason = rejectReason(file.type)
      if (reason) {
        fail(reason)
        return
      }
      void (async () => {
        try {
          const buffer = await readFileAsArrayBuffer(file)
          const bitmap = await createImageBitmap(new Blob([buffer], { type: file.type }))
          source = { file, bitmap, width: bitmap.width, height: bitmap.height }
          if (objectUrl) URL.revokeObjectURL(objectUrl)
          objectUrl = URL.createObjectURL(file)
          beforeImage.src = objectUrl
          beforeCaption.textContent = `Original · ${bitmap.width}×${bitmap.height}`
          const preset = presetById(activePreset)
          if (preset) {
            widthInput.value = String(preset.width)
            heightInput.value = String(preset.height)
          }
          await refresh()
        } catch {
          fail('That file could not be decoded as an image.')
        }
      })()
    }

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0]
      if (file) load(file)
    })

    stage.addEventListener('dragover', (event) => {
      event.preventDefault()
      stage.classList.add('is-dragging')
    })
    stage.addEventListener('dragleave', () => stage.classList.remove('is-dragging'))
    stage.addEventListener('drop', (event) => {
      event.preventDefault()
      stage.classList.remove('is-dragging')
      const file = event.dataTransfer?.files?.[0]
      if (file) load(file)
    })

    for (const input of [widthInput, heightInput]) {
      input.addEventListener('input', () => void refresh())
    }
    percentInput.addEventListener('input', () => {
      percentReadout.textContent = `${percentInput.value}%`
      widthInput.value = ''
      heightInput.value = ''
      activePreset = ''
      renderPresets()
      void refresh()
    })
    lockAspect.addEventListener('change', () => void refresh())
    formatSelect.addEventListener('change', () => {
      qualityRow.hidden = !selectedFormat().quality
      void refresh()
    })
    qualityInput.addEventListener('input', () => {
      quality = Number(qualityInput.value) / 100
      qualityReadout.textContent = `${qualityInput.value}%`
      void refresh()
    })

    const downloadButton = el(
      'button',
      {
        type: 'button',
        class: 'ts-button ts-primary',
        onclick: () => {
          if (!source || !lastBlob) return
          const box = requestedBox()
          if (!box) return
          download(resizeFilename(source.file.name, box, selectedFormat().extension), lastBlob)
        },
      },
      'Download',
    ) as HTMLButtonElement

    qualityRow.append(el('label', {}, 'Quality'), qualityInput, qualityReadout)
    customFields.append(
      el('div', { class: 'ts-inline-field' }, el('label', {}, 'Width'), widthInput),
      el('div', { class: 'ts-inline-field' }, el('label', {}, 'Height'), heightInput),
      el('label', { class: 'ts-inline-field' }, lockAspect, 'Lock aspect ratio'),
      el('div', { class: 'ts-slider-field' }, el('label', {}, 'Scale'), percentInput, percentReadout),
    )

    renderModes()
    renderPresets()

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Image'), el('div', { class: 'ts-tool-actions' }, fileInput), warning),
        status,
        el(
          'div',
          { class: 'ts-resize-compare' },
          stage,
          el('figure', { class: 'ts-resize-pane' }, beforeImage, beforeCaption),
          el('figure', { class: 'ts-resize-pane' }, afterImage, afterCaption),
        ),
        el('div', { class: 'ts-subhead' }, 'Resize mode'),
        modeBar,
        modeHint,
        el('div', { class: 'ts-subhead' }, 'Preset'),
        presetBar,
        el('div', { class: 'ts-subhead' }, 'Custom size'),
        customFields,
        el('div', { class: 'ts-inline-field' }, el('label', {}, 'Format'), formatSelect),
        qualityRow,
        resultInfo,
        el('div', { class: 'ts-tool-actions' }, downloadButton),
        el(
          'p',
          { class: 'ts-note' },
          'The image is decoded, redrawn and re-encoded on a canvas in your browser. Nothing is uploaded — the whole resize happens in this tab.',
        ),
      ),
    )
  },
}

export default tool
