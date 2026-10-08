import {
  actions,
  button,
  checkbox,
  copyRow,
  dropzone,
  field,
  mediaFrame,
  note,
  panel,
  segmented,
  select,
  slider,
  textField,
  toolLayout,
} from '../../core/components'
import { download } from '../../core/ui'
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

    const warning = note('', 'danger')
    warning.hidden = true
    const status = document.createElement('p')
    status.className = 'ts-k-hint'
    status.textContent = 'Choose an image to begin.'

    const beforeFrame = mediaFrame({ alt: 'Original', maxHeight: 300 })
    const afterFrame = mediaFrame({ alt: 'Resized', maxHeight: 300 })
    const beforeCaption = document.createElement('p')
    beforeCaption.className = 'ts-k-hint'
    beforeCaption.textContent = 'Original'
    const afterCaption = document.createElement('p')
    afterCaption.className = 'ts-k-hint'
    afterCaption.textContent = 'Resized'

    const widthInput = textField({ type: 'number', placeholder: 'width', onInput: () => void refresh() })
    widthInput.min = '1'
    const heightInput = textField({ type: 'number', placeholder: 'height', onInput: () => void refresh() })
    heightInput.min = '1'
    let locked = true
    const lockAspect = checkbox({
      label: 'Lock aspect ratio',
      checked: true,
      onChange: (checked) => {
        locked = checked
        void refresh()
      },
    })

    const formatSelect = select({
      value: FORMATS[formatIndex].mime,
      options: FORMATS.map((format) => ({ value: format.mime, label: format.label })),
      onChange: () => {
        qualitySlider.hidden = !selectedFormat().quality
        void refresh()
      },
    })

    const qualitySlider = slider({
      label: 'Quality',
      min: 10,
      max: 100,
      value: 90,
      format: (value) => `${value}%`,
      onInput: (value) => {
        quality = value / 100
        void refresh()
      },
    })

    const scaleSlider = slider({
      label: 'Scale',
      min: 10,
      max: 200,
      value: 100,
      format: (value) => `${value}%`,
      onInput: () => {
        widthInput.value = ''
        heightInput.value = ''
        activePreset = ''
        renderPresets()
        void refresh()
      },
    })

    const resultInfo = document.createElement('div')
    resultInfo.className = 'ts-k-kvlist'

    const modeHint = document.createElement('p')
    modeHint.className = 'ts-k-hint'
    modeHint.textContent = MODE_HINTS[mode]

    const modeBar = segmented({
      label: 'Resize mode',
      value: mode,
      items: (['fit', 'fill', 'stretch'] as ResizeMode[]).map((value) => ({
        value,
        label: value === 'fit' ? 'Fit' : value === 'fill' ? 'Fill' : 'Stretch',
        hint: value === 'fit' ? 'contain' : value === 'fill' ? 'crop' : 'stretch',
      })),
      onChange: (value) => {
        mode = value as ResizeMode
        modeHint.textContent = MODE_HINTS[mode]
        void refresh()
      },
    })

    const presetBar = document.createElement('div')
    presetBar.className = 'ts-k-presets'

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
        return locked
          ? { width: Math.floor(width), height: Math.max(1, Math.round((width / source.width) * source.height)) }
          : { width: Math.floor(width), height: source.height }
      }
      if (height > 0) {
        return locked
          ? { width: Math.max(1, Math.round((height / source.height) * source.width)), height: Math.floor(height) }
          : { width: source.width, height: Math.floor(height) }
      }
      const preset = presetById(activePreset)
      if (preset) return { width: preset.width, height: preset.height }
      const range = scaleSlider.querySelector('input') as HTMLInputElement
      return percentBox(source, Number(range.value) || 100)
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
      afterFrame.image.src = objectUrl

      const format = selectedFormat()
      resultInfo.replaceChildren(
        copyRow('Original', `${source.width}×${source.height} · ${formatBytes(source.file.size)}`),
        copyRow('Resized', `${drawn.box.width}×${drawn.box.height} · ${formatBytes(drawn.blob.size)}`),
      )
      status.textContent = `${source.file.name} — ready as ${format.label}`
    }

    function renderPresets() {
      presetBar.replaceChildren()
      for (const group of GROUPS) {
        presetBar.append(
          Object.assign(document.createElement('span'), { className: 'ts-k-presets__group', textContent: group }),
        )
        const row = document.createElement('div')
        row.className = 'ts-k-presets__row'
        for (const preset of presetsInGroup(group)) {
          const node = document.createElement('button')
          node.type = 'button'
          node.className = 'ts-k-preset'
          node.title = `${preset.width}×${preset.height}`
          if (preset.id === activePreset) node.classList.add('is-on')
          node.append(
            Object.assign(document.createElement('span'), { className: 'ts-k-preset__label', textContent: preset.label }),
            Object.assign(document.createElement('span'), {
              className: 'ts-k-preset__dim',
              textContent: `${preset.width}×${preset.height}`,
            }),
          )
          node.addEventListener('click', () => {
            activePreset = preset.id
            widthInput.value = String(preset.width)
            heightInput.value = String(preset.height)
            renderPresets()
            void refresh()
          })
          row.append(node)
        }
        presetBar.append(row)
      }
    }

    async function load(file: File, buffer: ArrayBuffer) {
      warning.hidden = true
      const reason = rejectReason(file.type)
      if (reason) {
        fail(reason)
        return
      }
      try {
        const bitmap = await createImageBitmap(new Blob([buffer], { type: file.type }))
        source = { file, bitmap, width: bitmap.width, height: bitmap.height }
        if (objectUrl) URL.revokeObjectURL(objectUrl)
        objectUrl = URL.createObjectURL(file)
        beforeFrame.image.src = objectUrl
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
    }

    const picker = dropzone({
      label: 'Drop an image here',
      hint: 'PNG, JPEG, WebP, GIF, BMP, AVIF…',
      accept: 'image/*',
      icon: 'image',
      onFiles: () => {},
      onBuffers: ([buffer], files) => void load(files[0], buffer),
    })

    const downloadButton = button('Download', {
      variant: 'primary',
      icon: 'download',
      onClick: () => {
        if (!source || !lastBlob) return
        const box = requestedBox()
        if (!box) return
        download(resizeFilename(source.file.name, box, selectedFormat().extension), lastBlob)
      },
    })

    renderPresets()

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'Image', icon: 'uploadCloud' }, picker.root, warning, status),
        panel(
          { title: 'Compare', icon: 'eye' },
          splitFrames(beforeFrame.root, beforeCaption, afterFrame.root, afterCaption),
        ),
        panel(
          { title: 'How to fit it', icon: 'sliders' },
          modeBar,
          modeHint,
          presetBar,
        ),
        panel(
          { title: 'Exact size', icon: 'ruler' },
          actions(
            field(widthInput, { label: 'Width' }),
            field(heightInput, { label: 'Height' }),
            lockAspect,
          ),
          scaleSlider,
          actions(field(formatSelect, { label: 'Format' })),
          qualitySlider,
          resultInfo,
        ),
        actions(downloadButton),
        note('The image is decoded, redrawn and re-encoded on a canvas in your browser. Nothing is uploaded — the whole resize happens in this tab.'),
      ),
    )
  },
}

/** Two bounded previews side by side, each with its own caption. */
function splitFrames(...children: (Node | string)[]): HTMLElement {
  const root = document.createElement('div')
  root.className = 'ts-k-split'
  root.append(...children)
  return root
}

export default tool
