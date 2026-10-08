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

    const settings: RemovalSettings = { tolerance: 12, feather: 1, despill: 0.5 }

    const fileInput = el('input', { type: 'file', accept: 'image/*', class: 'ts-file-input' }) as HTMLInputElement
    const status = el('p', { class: 'ts-muted' }, 'Choose an image, or drop one anywhere on this panel.')
    const warning = el('p', { class: 'ts-error', hidden: true })

    const stage = el('div', { class: 'ts-cut-stage' })
    const originalCanvas = el('canvas', { class: 'ts-cut-canvas' }) as HTMLCanvasElement
    const resultCanvas = el('canvas', { class: 'ts-cut-canvas ts-cut-result' }) as HTMLCanvasElement
    const beforePanel = el('figure', { class: 'ts-cut-pane' }, originalCanvas, el('figcaption', {}, 'Original'))
    const afterPanel = el('figure', { class: 'ts-cut-pane' }, resultCanvas, el('figcaption', {}, 'Cut out'))

    const backdropSwatch = el('span', { class: 'ts-backdrop-chip' })
    const backdropHex = el('span', { class: 'ts-mono ts-muted' }, '—')
    const pickButton = el('button', { type: 'button', class: 'ts-button' }, 'Pick from image')
    const resetButton = el('button', { type: 'button', class: 'ts-button' }, 'Reset to edges')

    const controls = el('div', { class: 'ts-cut-controls' })
    const actions = el('div', { class: 'ts-tool-actions' })
    const stats = el('p', { class: 'ts-muted' })

    const context = originalCanvas.getContext('2d', { willReadFrequently: true })
    const resultContext = resultCanvas.getContext('2d', { willReadFrequently: true })

    let picking = false

    function slider(key: keyof RemovalSettings, label: string, min: number, max: number, step: number, hint: string) {
      const input = el('input', {
        class: 'ts-range',
        type: 'range',
        min: String(min),
        max: String(max),
        step: String(step),
        value: String(settings[key]),
      }) as HTMLInputElement
      const readout = el('span', { class: 'ts-mono ts-muted' }, String(settings[key]))
      input.addEventListener('input', () => {
        settings[key] = Number(input.value)
        readout.textContent = input.value
        render()
      })
      return el(
        'div',
        { class: 'ts-cut-control' },
        el('div', { class: 'ts-cut-control-head' }, el('label', {}, label), readout),
        input,
        el('span', { class: 'ts-cut-hint' }, hint),
      )
    }

    function fail(message: string) {
      warning.textContent = message
      warning.hidden = false
    }

    function updateBackdrop() {
      backdropSwatch.style.background = backdrop ? `rgb(${backdrop.r} ${backdrop.g} ${backdrop.b})` : 'transparent'
      backdropHex.textContent = backdrop ? `rgb(${backdrop.r} ${backdrop.g} ${backdrop.b})` : '—'
    }

    /** Redraw the cut-out from the untouched source pixels. */
    function render() {
      if (!source || !resultContext || !backdrop) return
      const result = removeBackground(source.data, source.width, source.height, settings, backdrop)
      const imageData = resultContext.createImageData(source.width, source.height)
      imageData.data.set(result)
      resultContext.putImageData(imageData, 0, 0)
      updateStats(result)
    }

    function updateStats(result: Uint8ClampedArray) {
      let transparent = 0
      for (let i = 3; i < result.length; i += 4) {
        if (result[i] < 16) transparent += 1
      }
      const total = result.length / 4
      const pct = total === 0 ? 0 : Math.round((transparent / total) * 100)
      stats.textContent = `${pct}% of pixels removed · ${source?.width}×${source?.height}`
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
      picking = false
      originalCanvas.classList.remove('is-picking')
      pickButton.classList.remove('is-active')
      updateBackdrop()
      render()
    })

    pickButton.addEventListener('click', () => {
      picking = !picking
      originalCanvas.classList.toggle('is-picking', picking)
      pickButton.classList.toggle('is-active', picking)
    })

    resetButton.addEventListener('click', () => {
      if (!source) return
      backdrop = estimateBackground(source.data, source.width, source.height)
      updateBackdrop()
      render()
    })

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
      if (file && file.type.startsWith('image/')) load(file)
      else if (file) fail('That file is not an image.')
    })

    function exportPng() {
      if (!resultCanvas.width) return
      resultCanvas.toBlob((blob) => {
        if (blob) download(`${fileName}-cutout.png`, blob, 'image/png')
      }, 'image/png')
    }

    controls.append(
      slider('tolerance', 'Tolerance', 0, 60, 1, 'How far a pixel may differ from the backdrop and still count as background.'),
      slider('feather', 'Edge feather', 0, 6, 1, 'Softens the cut edge so it does not look like scissors work.'),
      slider('despill', 'Backdrop despill', 0, 1, 0.05, 'Removes leftover backdrop tint from the subject edges.'),
    )

    actions.append(
      el('button', { type: 'button', class: 'ts-button ts-button-primary', onclick: exportPng }, 'Download PNG'),
      pickButton,
      resetButton,
    )

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el(
          'div',
          { class: 'ts-field' },
          el(
            'div',
            { class: 'ts-row ts-between' },
            el('label', {}, 'Image'),
            el('div', { class: 'ts-tool-actions' }, fileInput),
          ),
          status,
          warning,
          el(
            'div',
            { class: 'ts-backdrop-row' },
            el('span', { class: 'ts-muted' }, 'Backdrop colour'),
            backdropSwatch,
            backdropHex,
          ),
        ),
        stage,
        el('div', { class: 'ts-subhead' }, 'Adjust'),
        controls,
        stats,
        actions,
        el(
          'p',
          { class: 'ts-cut-note' },
          'This works by flood filling inward from the image border, so it is built for flat or near-flat backdrops — logos, icons, screenshots, product shots. A busy photographic background needs a segmentation model, which cannot run here without uploading your image.',
        ),
      ),
    )

    stage.append(beforePanel, afterPanel)
    updateBackdrop()
  },
}

export default tool
