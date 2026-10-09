import {
  actions,
  button,
  colorField,
  dropzone,
  mediaFrame,
  note,
  panel,
  segmented,
  slider,
  stat,
  stats,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import { download } from '../../core/ui'
import type { Tool } from '../../core/types'
import {
  compositeBackground,
  estimateBackground,
  hexToRgb,
  removeBackground,
  rgbToHex,
  type BackgroundFill,
  type BrushStroke,
  type RemovalSettings,
  type Rgb,
} from './bg'

/** Quick-pick backdrops. Everything else is reachable through the pickers. */
const SOLID_PRESETS: Array<{ label: string; hex: string }> = [
  { label: 'White', hex: '#ffffff' },
  { label: 'Black', hex: '#111318' },
  { label: 'Slate', hex: '#64748b' },
  { label: 'Sky', hex: '#38bdf8' },
  { label: 'Lime', hex: '#ccff4d' },
  { label: 'Rose', hex: '#fb7185' },
]

const GRADIENT_PRESETS: Array<{ label: string; from: string; to: string; angle: number }> = [
  { label: 'Dusk', from: '#7c3aed', to: '#22d3ee', angle: 20 },
  { label: 'Sunset', from: '#fb7185', to: '#facc15', angle: 45 },
  { label: 'Mono', from: '#e2e8f0', to: '#475569', angle: 90 },
  { label: 'Deep', from: '#0f172a', to: '#1e3a8a', angle: 135 },
]

type BrushMode = 'off' | 'erase' | 'restore'

const tool: Tool = {
  slug: 'remove-background',
  name: 'Remove Image Background',
  description:
    'Erase a flat background, tidy the edges with a brush, then drop in a colour or gradient — all on canvas, offline.',
  category: 'Media',
  keywords: [
    'remove background',
    'transparent',
    'png',
    'cutout',
    'logo',
    'despill',
    'chroma key',
    'transparency',
    'brush',
    'erase',
    'restore',
    'background color',
    'gradient background',
  ],
  render(root) {
    let source: ImageData | null = null
    let objectUrl = ''
    let backdrop: Rgb | null = null
    let fileName = 'image'
    let picking = false

    const settings: RemovalSettings = { tolerance: 12, feather: 1, despill: 0.5 }
    /** Manual touch-ups, applied on top of the automatic flood fill. */
    const strokes: BrushStroke[] = []
    let brushMode: BrushMode = 'off'
    let brushSize = 40
    let fill: BackgroundFill = { kind: 'transparent' }

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

    /** A circular preview of the brush that tracks the pointer over the image. */
    const brushCursor = el('span', { class: 'ts-cut-brush', 'aria-hidden': 'true' })
    const brushWrap = el('div', { class: 'ts-cut-brushwrap' }, originalCanvas, brushCursor)

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
    const clearButton = button('Clear brush', { icon: 'eraser' })

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

    function fillSwatchBackground(node: HTMLElement) {
      if (fill.kind === 'transparent') {
        node.style.background =
          'repeating-conic-gradient(#cbd5e1 0% 25%, #f8fafc 0% 50%) 50% / 8px 8px'
      } else if (fill.kind === 'solid') {
        node.style.background = rgbToHex(fill.color)
      } else {
        node.style.background = `linear-gradient(${fill.angle}deg, ${rgbToHex(fill.from)}, ${rgbToHex(fill.to)})`
      }
    }

    /** Redraw the cut-out from the untouched source pixels. */
    function render() {
      if (!source || !resultContext || !backdrop) return
      const cut = removeBackground(source.data, source.width, source.height, settings, backdrop, strokes)
      if (fill.kind !== 'transparent') compositeBackground(cut, source.width, source.height, fill)
      const imageData = resultContext.createImageData(source.width, source.height)
      imageData.data.set(cut)
      resultContext.putImageData(imageData, 0, 0)

      let transparent = 0
      for (let i = 3; i < cut.length; i += 4) if (cut[i] < 16) transparent += 1
      const total = cut.length / 4
      const pct = total === 0 ? 0 : Math.round((transparent / total) * 100)
      readout.replaceChildren(
        stat({ label: 'Removed', value: fill.kind === 'transparent' ? `${pct}%` : '0%' }),
        stat({ label: 'Strokes', value: String(strokes.length) }),
        stat({ label: 'Size', value: `${source.width}×${source.height}` }),
      )
      clearButton.disabled = strokes.length === 0
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
        strokes.length = 0
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

    function moveBrushCursor(event: PointerEvent) {
      const rect = originalCanvas.getBoundingClientRect()
      if (rect.width === 0) return
      const scale = rect.width / originalCanvas.width
      const size = Math.max(6, brushSize * 2 * scale)
      brushCursor.style.width = `${size}px`
      brushCursor.style.height = `${size}px`
      brushCursor.style.transform = `translate(${event.clientX - rect.left - size / 2}px, ${event.clientY - rect.top - size / 2}px)`
    }

    function setPicking(value: boolean) {
      picking = value
      originalCanvas.classList.toggle('is-picking', value)
      pickButton.classList.toggle('is-on', value)
    }

    function setBrushMode(value: BrushMode) {
      brushMode = value
      originalCanvas.classList.toggle('is-brushing', value !== 'off')
      brushCursor.classList.toggle('is-on', value !== 'off')
      if (value !== 'off') setPicking(false)
    }

    /* --- Brush painting ---------------------------------------------------- */

    let drawing: BrushStroke | null = null
    let queued = false

    function scheduleRender() {
      if (queued) return
      queued = true
      requestAnimationFrame(() => {
        queued = false
        render()
      })
    }

    originalCanvas.addEventListener('pointerdown', (event) => {
      if (!context) return
      const point = toSourcePoint(event)

      if (brushMode === 'off') {
        if (!picking) return
        if (point.x < 0 || point.y < 0 || point.x >= originalCanvas.width || point.y >= originalCanvas.height) return
        const data = context.getImageData(point.x, point.y, 1, 1).data
        backdrop = { r: data[0], g: data[1], b: data[2] }
        setPicking(false)
        updateBackdrop()
        render()
        return
      }

      event.preventDefault()
      drawing = { mode: brushMode, radius: brushSize / 2, points: [point] }
      strokes.push(drawing)
      originalCanvas.setPointerCapture(event.pointerId)
      render()
    })

    originalCanvas.addEventListener('pointermove', (event) => {
      if (brushMode !== 'off') moveBrushCursor(event)
      if (!drawing) return
      const point = toSourcePoint(event)
      const last = drawing.points[drawing.points.length - 1]
      // Skip sub-pixel jitter; the stroke interpolates between kept points.
      if (Math.hypot(point.x - last.x, point.y - last.y) < brushSize / 8) return
      drawing.points.push(point)
      scheduleRender()
    })

    function endStroke() {
      if (!drawing) return
      drawing = null
      render()
    }
    originalCanvas.addEventListener('pointerup', endStroke)
    originalCanvas.addEventListener('pointercancel', endStroke)
    originalCanvas.addEventListener('pointerleave', () => {
      brushCursor.classList.remove('is-over')
      endStroke()
    })
    originalCanvas.addEventListener('pointerenter', () => {
      if (brushMode !== 'off') brushCursor.classList.add('is-over')
    })

    pickButton.addEventListener('click', () => {
      if (brushMode !== 'off') setBrushMode('off')
      setPicking(!picking)
    })

    resetButton.addEventListener('click', () => {
      if (!source) return
      backdrop = estimateBackground(source.data, source.width, source.height)
      updateBackdrop()
      render()
    })

    clearButton.addEventListener('click', () => {
      strokes.length = 0
      render()
    })

    /* --- Replacement background -------------------------------------------- */

    const fillSeg = segmented({
      label: 'Replacement background',
      value: 'transparent',
      items: [
        { value: 'transparent', label: 'None' },
        { value: 'solid', label: 'Colour' },
        { value: 'linear', label: 'Gradient' },
      ],
      onChange: (value) => {
        if (value === 'transparent') fill = { kind: 'transparent' }
        else if (value === 'solid') fill = { kind: 'solid', color: hexToRgb(solidField.hex.value || '#ffffff') }
        else fill = { kind: 'linear', from: hexToRgb(gradFrom.hex.value), to: hexToRgb(gradTo.hex.value), angle: angleValue }
        syncFillControls()
        render()
      },
    })

    const solidField = colorField({
      value: '#ffffff',
      label: 'Colour',
      onInput: (value) => {
        fill = { kind: 'solid', color: hexToRgb(value) }
        syncFillControls()
        render()
      },
    })

    let angleValue = 20
    const angleSlider = slider({
      label: 'Gradient angle',
      min: 0,
      max: 360,
      value: angleValue,
      format: (value) => `${value}°`,
      onInput: (value) => {
        angleValue = value
        if (fill.kind === 'linear') fill = { ...fill, angle: value }
        syncFillControls()
        render()
      },
    })

    const gradFrom = colorField({
      value: GRADIENT_PRESETS[0].from,
      label: 'From',
      onInput: (value) => {
        if (fill.kind === 'linear') fill = { ...fill, from: hexToRgb(value) }
        syncFillControls()
        render()
      },
    })
    const gradTo = colorField({
      value: GRADIENT_PRESETS[0].to,
      label: 'To',
      onInput: (value) => {
        if (fill.kind === 'linear') fill = { ...fill, to: hexToRgb(value) }
        syncFillControls()
        render()
      },
    })

    const solidPresets = el('div', { class: 'ts-cut-swatches', role: 'group', 'aria-label': 'Preset colours' })
    for (const preset of SOLID_PRESETS) {
      solidPresets.append(
        el('button', {
          class: 'ts-cut-swatch',
          type: 'button',
          title: preset.label,
          'aria-label': `${preset.label} background`,
          style: `--sw:${preset.hex}`,
          onclick: () => {
            fill = { kind: 'solid', color: hexToRgb(preset.hex) }
            fillSeg.setValue('solid')
            solidField.swatch.value = preset.hex
            solidField.hex.value = preset.hex
            syncFillControls()
            render()
          },
        }),
      )
    }

    const gradientPresets = el('div', { class: 'ts-cut-swatches', role: 'group', 'aria-label': 'Preset gradients' })
    for (const preset of GRADIENT_PRESETS) {
      gradientPresets.append(
        el(
          'button',
          {
            class: 'ts-cut-swatch',
            type: 'button',
            title: preset.label,
            'aria-label': `${preset.label} gradient background`,
            style: `--sw:linear-gradient(${preset.angle}deg, ${preset.from}, ${preset.to})`,
            onclick: () => {
              angleValue = preset.angle
              angleSlider.querySelector<HTMLInputElement>('input')!.value = String(preset.angle)
              gradFrom.swatch.value = preset.from
              gradFrom.hex.value = preset.from
              gradTo.swatch.value = preset.to
              gradTo.hex.value = preset.to
              fill = { kind: 'linear', from: hexToRgb(preset.from), to: hexToRgb(preset.to), angle: preset.angle }
              fillSeg.setValue('linear')
              syncFillControls()
              render()
            },
          },
        ),
      )
    }

    const solidControls = el('div', { class: 'ts-cut-fill-group' }, solidPresets, solidField.root)
    const gradientControls = el('div', { class: 'ts-cut-fill-group' }, gradientPresets, gradFrom.root, gradTo.root, angleSlider)

    function syncFillControls() {
      solidControls.hidden = fill.kind !== 'solid'
      gradientControls.hidden = fill.kind !== 'linear'
      fillSwatchBackground(fillChip)
    }

    const fillChip = el('span', { class: 'ts-cut-chip ts-cut-chip--lg' })
    const fillRow = el('div', { class: 'ts-cut-backdrop' }, el('span', { class: 'ts-k-label' }, 'Current'), fillChip)

    /* --- Brush controls ---------------------------------------------------- */

    const brushSeg = segmented({
      label: 'Brush',
      value: 'off',
      items: [
        { value: 'off', label: 'Off' },
        { value: 'erase', label: 'Erase' },
        { value: 'restore', label: 'Restore' },
      ],
      onChange: (value) => {
        setBrushMode(value as BrushMode)
        brushSizeWrap.hidden = value === 'off'
      },
    })

    const brushSizeWrap = slider({
      label: 'Brush size',
      min: 4,
      max: 160,
      value: brushSize,
      format: (value) => `${value}px`,
      onInput: (value) => {
        brushSize = value
      },
    })
    brushSizeWrap.hidden = true

    function exportPng() {
      if (!resultCanvas.width) return
      const opaque = fill.kind !== 'transparent'
      resultCanvas.toBlob((blob) => {
        if (blob) download(`${fileName}-${opaque ? 'background' : 'cutout'}.png`, blob, 'image/png')
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

    original.root.append(brushWrap)
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
            el(
              'figure',
              { class: 'ts-cut-pane' },
              original.root,
              el('figcaption', {}, 'Original — paint to erase or restore'),
            ),
            el('figure', { class: 'ts-cut-pane' }, result.root, el('figcaption', {}, 'Result')),
          ),
        ),
        panel({ title: 'Touch up', icon: 'eraser' }, brushSeg, brushSizeWrap, actions(clearButton)),
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
        panel({ title: 'Background', icon: 'palette' }, fillSeg, fillRow, solidControls, gradientControls),
        note(
          'Removal is a flood fill inward from the image border, so it is built for flat or near-flat backdrops — logos, icons, screenshots, product shots. Use the brush to tidy up the edges by hand, then drop in a colour or gradient. A busy photographic background needs a segmentation model, which cannot run here without uploading your image.',
        ),
      ),
    )

    setBrushMode('off')
    syncFillControls()
    clearButton.disabled = true
    updateBackdrop()
  },
}

export default tool
