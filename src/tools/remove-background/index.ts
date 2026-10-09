import {
  actions,
  button,
  dropzone,
  mediaFrame,
  note,
  panel,
  slider,
  stat,
  stats,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import { download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { estimateBackground, removeBackground, type RemovalSettings, type Rgb } from './bg'

const tool: Tool = {
  slug: 'remove-background',
  name: 'Remove Image Background',
  description: 'Erase a flat background from a logo, screenshot or product shot — on canvas, offline.',
  category: 'Media',
  keywords: ['remove background', 'transparent', 'png', 'cutout', 'logo', 'despill', 'chroma key', 'transparency'],
  render(root) {
    let source: ImageData | null = null
    let objectUrl = ''
    let backdrop: Rgb | null = null
    let fileName = 'image'
    let picking = false

    const settings: RemovalSettings = { tolerance: 12, feather: 1, despill: 0.5 }

    const status = note('Choose an image, or drop one anywhere on this panel.')
    const warning = note('', 'danger')
    warning.hidden = true
    const readout = stats()

    const original = mediaFrame({ alt: 'Original image', maxHeight: 420 })
    const result = mediaFrame({ alt: 'Image with the background removed', maxHeight: 420, checker: true })
    const originalCanvas = el('canvas', { class: 'ts-cut-canvas' }) as HTMLCanvasElement
    const resultCanvas = el('canvas', { class: 'ts-cut-canvas' }) as HTMLCanvasElement
    original.image.hidden = true
    result.image.hidden = true

    const backdropChip = el('span', { class: 'ts-cut-chip' })
    const backdropText = el('span', { class: 'ts-k-mono ts-k-hint' }, '—')
    const backdropRow = el(
      'div',
      { class: 'ts-cut-backdrop' },
      el('span', { class: 'ts-k-label' }, 'Backdrop'),
      backdropChip,
      backdropText,
    )

    const pickButton = button('Pick from image', { icon: 'eye' })
    const resetButton = button('Reset to edges', { icon: 'refresh' })

    const context = originalCanvas.getContext('2d', { willReadFrequently: true })
    const resultContext = resultCanvas.getContext('2d', { willReadFrequently: true })

    function fail(message: string) {
      warning.textContent = message
      warning.hidden = false
    }

    function updateBackdrop() {
      backdropChip.style.background = backdrop ? `rgb(${backdrop.r} ${backdrop.g} ${backdrop.b})` : 'transparent'
      backdropText.textContent = backdrop ? `rgb(${backdrop.r} ${backdrop.g} ${backdrop.b})` : '—'
    }

    /** Redraw the cut-out from the untouched source pixels. */
    function render() {
      if (!source || !resultContext || !backdrop) return
      const cut = removeBackground(source.data, source.width, source.height, settings, backdrop)
      const imageData = resultContext.createImageData(source.width, source.height)
      imageData.data.set(cut)
      resultContext.putImageData(imageData, 0, 0)

      let transparent = 0
      for (let i = 3; i < cut.length; i += 4) if (cut[i] < 16) transparent += 1
      const total = cut.length / 4
      const pct = total === 0 ? 0 : Math.round((transparent / total) * 100)
      readout.replaceChildren(
        stat({ label: 'Removed', value: `${pct}%` }),
        stat({ label: 'Size', value: `${source.width}×${source.height}` }),
      )
    }

    function load(file: File) {
      warning.hidden = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      objectUrl = URL.createObjectURL(file)
      fileName = file.name.replace(/\.[^.]+$/, '') || 'image'

      const image = new Image()
      image.onload = () => {
        if (!context || !resultContext) return
        for (const canvas of [originalCanvas, resultCanvas]) {
          canvas.width = image.naturalWidth
          canvas.height = image.naturalHeight
          canvas.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`
        }
        context.drawImage(image, 0, 0)
        source = context.getImageData(0, 0, image.naturalWidth, image.naturalHeight)
        backdrop = estimateBackground(source.data, source.width, source.height)
        status.textContent = `${file.name} — ${image.naturalWidth}×${image.naturalHeight}`
        updateBackdrop()
        render()
      }
      image.onerror = () => fail('That file could not be decoded as an image.')
      image.src = objectUrl
    }

    function toSourcePoint(event: PointerEvent): { x: number; y: number } {
      const rect = originalCanvas.getBoundingClientRect()
      return {
        x: Math.floor(((event.clientX - rect.left) / rect.width) * originalCanvas.width),
        y: Math.floor(((event.clientY - rect.top) / rect.height) * originalCanvas.height),
      }
    }

    originalCanvas.addEventListener('pointerdown', (event) => {
      if (!picking || !context) return
      const { x, y } = toSourcePoint(event)
      if (x < 0 || y < 0 || x >= originalCanvas.width || y >= originalCanvas.height) return
      const data = context.getImageData(x, y, 1, 1).data
      backdrop = { r: data[0], g: data[1], b: data[2] }
      setPicking(false)
      updateBackdrop()
      render()
    })

    function setPicking(value: boolean) {
      picking = value
      originalCanvas.classList.toggle('is-picking', value)
      pickButton.classList.toggle('is-on', value)
    }

    pickButton.addEventListener('click', () => setPicking(!picking))

    resetButton.addEventListener('click', () => {
      if (!source) return
      backdrop = estimateBackground(source.data, source.width, source.height)
      updateBackdrop()
      render()
    })

    function exportPng() {
      if (!resultCanvas.width) return
      resultCanvas.toBlob((blob) => {
        if (blob) download(`${fileName}-cutout.png`, blob, 'image/png')
      }, 'image/png')
    }

    const drop = dropzone({
      label: 'Drop an image here',
      hint: 'PNG, JPEG or WebP',
      accept: 'image/*',
      icon: 'image',
      onFiles: (files) => {
        const file = files[0]
        if (!file) return
        if (file.type && !file.type.startsWith('image/')) fail('That file is not an image.')
        else load(file)
      },
    })

    original.root.append(originalCanvas)
    result.root.append(resultCanvas)

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'Image', icon: 'uploadCloud' }, drop.root, status, warning, backdropRow),
        panel(
          { title: 'Before and after', icon: 'sliders' },
          el(
            'div',
            { class: 'ts-cut-stage' },
            el('figure', { class: 'ts-cut-pane' }, original.root, el('figcaption', {}, 'Original')),
            el('figure', { class: 'ts-cut-pane' }, result.root, el('figcaption', {}, 'Cut out')),
          ),
        ),
        panel(
          { title: 'Adjust', icon: 'sliders' },
          slider({
            label: 'Tolerance',
            min: 0,
            max: 60,
            value: settings.tolerance,
            onInput: (value) => {
              settings.tolerance = value
              render()
            },
          }),
          slider({
            label: 'Edge feather',
            min: 0,
            max: 6,
            value: settings.feather,
            onInput: (value) => {
              settings.feather = value
              render()
            },
          }),
          slider({
            label: 'Backdrop despill',
            min: 0,
            max: 1,
            step: 0.05,
            value: settings.despill,
            format: (value) => value.toFixed(2),
            onInput: (value) => {
              settings.despill = value
              render()
            },
          }),
          readout,
          actions(
            button('Download PNG', { variant: 'primary', icon: 'download', onClick: exportPng }),
            pickButton,
            resetButton,
          ),
        ),
        note(
          'This works by flood filling inward from the image border, so it is built for flat or near-flat backdrops — logos, icons, screenshots, product shots. A busy photographic background needs a segmentation model, which cannot run here without uploading your image.',
        ),
      ),
    )

    updateBackdrop()
  },
}

export default tool
