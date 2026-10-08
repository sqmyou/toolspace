import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { formatHsl, formatRgb, rgbToHsl, toHex } from '../color-converter/color'
import { contrastWithWhite, dominantColors, formatPercent, paletteToCss, paletteToList, readableInk, type Sample } from './sample'

const tool: Tool = {
  slug: 'image-color-picker',
  name: 'Image Colour Picker',
  description: 'Pick colours from an image, or pull out its dominant palette — all on canvas, nothing uploaded.',
  category: 'Media',
  keywords: ['eyedropper', 'colour picker', 'color picker', 'palette', 'dominant colors', 'image', 'hex', 'swatch', 'extract'],
  render(root) {
    let image: HTMLImageElement | null = null
    let objectUrl = ''
    let hover: Sample | null = null

    const fileInput = el('input', { type: 'file', accept: 'image/*', class: 'ts-file-input' }) as HTMLInputElement
    const status = el('p', { class: 'ts-muted' }, 'Choose an image, or drop one anywhere on this panel.')
    const warning = el('p', { class: 'ts-error', hidden: true })

    const stage = el('div', { class: 'ts-picker-stage' })
    const canvas = el('canvas', { class: 'ts-picker-canvas' }) as HTMLCanvasElement
    const loupe = el('div', { class: 'ts-loupe' })
    const loupeCanvas = el('canvas', { class: 'ts-loupe-canvas', width: '1', height: '1' }) as HTMLCanvasElement
    const loupeReadout = el('div', { class: 'ts-loupe-readout' })

    const swatchList = el('div', { class: 'ts-swatch-grid' })
    const currentPanel = el('div', { class: 'ts-picked' })
    const paletteActions = el('div', { class: 'ts-tool-actions' })

    const context = canvas.getContext('2d', { willReadFrequently: true })
    const loupeContext = loupeCanvas.getContext('2d', { willReadFrequently: true })

    function fail(message: string) {
      warning.textContent = message
      warning.hidden = false
    }

    /** Pixel colour at a canvas coordinate, or null outside the image. */
    function pixelAt(x: number, y: number): Sample | null {
      if (!context || !image) return null
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null
      const data = context.getImageData(x, y, 1, 1).data
      if (data[3] === 0) return null
      const rgb = { r: data[0], g: data[1], b: data[2] }
      return { hex: toHex(rgb), rgb, share: 0 }
    }

    function paintLoupe(x: number, y: number, sample: Sample | null) {
      if (!loupeContext || !image) return
      const size = 108
      loupeCanvas.width = size
      loupeCanvas.height = size
      loupeContext.clearRect(0, 0, size, size)
      loupeContext.imageSmoothingEnabled = false
      const source = 12
      loupeContext.drawImage(canvas, x - source / 2, y - source / 2, source, source, 0, 0, size, size)
      loupeContext.strokeStyle = sample ? readableInk(sample.rgb) : '#ffffff'
      loupeContext.lineWidth = 2
      const half = size / 2
      loupeContext.strokeRect(half - source * 1.5, half - source * 1.5, source * 3, source * 3)
      loupeReadout.replaceChildren(
        sample
          ? el(
              'span',
              { class: 'ts-loupe-hex' },
              el('span', { class: 'ts-loupe-chip', style: `background:${sample.hex}` }),
              sample.hex.toUpperCase(),
            )
          : el('span', { class: 'ts-muted' }, 'Outside the image'),
      )
    }

    function showCurrent(sample: Sample | null, label = 'Picked colour') {
      if (!sample) {
        currentPanel.replaceChildren(el('p', { class: 'ts-muted' }, 'Hover the image to sample a colour, then click to pin it.'))
        return
      }
      const hsl = rgbToHsl(sample.rgb)
      const contrast = contrastWithWhite(sample.rgb)
      currentPanel.replaceChildren(
        el('div', { class: 'ts-picked-chip', style: `background:${sample.hex}` }),
        el(
          'div',
          { class: 'ts-picked-meta' },
          el('span', { class: 'ts-picked-label' }, label),
          el(
            'div',
            { class: 'ts-copy-list' },
            el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, 'HEX'), el('span', { class: 'ts-value ts-mono' }, sample.hex.toUpperCase())),
            el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, 'RGB'), el('span', { class: 'ts-value ts-mono' }, formatRgb(sample.rgb))),
            el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, 'HSL'), el('span', { class: 'ts-value ts-mono' }, formatHsl(hsl))),
            el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, 'Contrast vs white'), el('span', { class: 'ts-value ts-mono' }, `${contrast.toFixed(2)}:1`)),
          ),
          el(
            'div',
            { class: 'ts-tool-actions' },
            copyChip(() => sample.hex, 'Copy HEX'),
            copyChip(() => formatRgb(sample.rgb), 'Copy RGB'),
            copyChip(() => formatHsl(hsl), 'Copy HSL'),
          ),
        ),
      )
    }

    function renderPalette(samples: Sample[]) {
      if (samples.length === 0) {
        swatchList.replaceChildren(el('p', { class: 'ts-muted' }, 'Load an image to see its palette.'))
        paletteActions.replaceChildren()
        return
      }
      swatchList.replaceChildren(
        ...samples.map((sample) =>
          el(
            'button',
            {
              type: 'button',
              class: 'ts-swatch',
              style: `background:${sample.hex};color:${readableInk(sample.rgb)}`,
              title: `${sample.hex} — click to copy`,
              onclick: () => {
                showCurrent(sample, 'Palette colour')
                void navigator.clipboard?.writeText(sample.hex)
              },
            },
            el('span', { class: 'ts-swatch-hex' }, sample.hex.toUpperCase()),
            el('span', { class: 'ts-swatch-share' }, formatPercent(sample.share)),
          ),
        ),
      )
      paletteActions.replaceChildren(
        copyChip(() => paletteToCss(samples), 'Copy CSS variables'),
        copyChip(() => paletteToList(samples), 'Copy hex list'),
      )
    }

    /** Sample a spread of pixels across the image and reduce them to a palette. */
    function extractPalette() {
      if (!context || !image) return
      const maxSide = 160
      const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height))
      const width = Math.max(1, Math.round(canvas.width * scale))
      const height = Math.max(1, Math.round(canvas.height * scale))

      const scratch = document.createElement('canvas')
      scratch.width = width
      scratch.height = height
      const scratchContext = scratch.getContext('2d', { willReadFrequently: true })
      if (!scratchContext) return
      scratchContext.drawImage(canvas, 0, 0, width, height)
      const data = scratchContext.getImageData(0, 0, width, height).data

      const pixels: string[] = []
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 8) continue
        pixels.push(toHex({ r: data[i], g: data[i + 1], b: data[i + 2] }))
      }
      renderPalette(dominantColors(pixels, 12, 2))
    }

    function load(file: File) {
      warning.hidden = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      objectUrl = URL.createObjectURL(file)
      const next = new Image()
      next.onload = () => {
        image = next
        canvas.width = next.naturalWidth
        canvas.height = next.naturalHeight
        canvas.style.aspectRatio = `${next.naturalWidth} / ${next.naturalHeight}`
        context?.drawImage(next, 0, 0)
        status.textContent = `${file.name} — ${next.naturalWidth}×${next.naturalHeight}`
        showCurrent(null)
        extractPalette()
      }
      next.onerror = () => fail('That file could not be decoded as an image.')
      next.src = objectUrl
    }

    /** Map a pointer event to canvas pixel coordinates, accounting for CSS scaling. */
    function toCanvasPoint(event: PointerEvent): { x: number; y: number } {
      const rect = canvas.getBoundingClientRect()
      const x = Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width)
      const y = Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height)
      return { x, y }
    }

    canvas.addEventListener('pointermove', (event) => {
      const { x, y } = toCanvasPoint(event)
      hover = pixelAt(x, y)
      loupe.hidden = false
      loupe.style.transform = `translate(${event.clientX + 16}px, ${event.clientY + 16}px)`
      paintLoupe(x, y, hover)
    })
    canvas.addEventListener('pointerleave', () => {
      loupe.hidden = true
    })
    canvas.addEventListener('pointerdown', (event) => {
      const { x, y } = toCanvasPoint(event)
      const sample = pixelAt(x, y)
      if (sample) showCurrent(sample)
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
          stage,
        ),
        el('div', { class: 'ts-subhead' }, 'Picked colour'),
        currentPanel,
        el('div', { class: 'ts-subhead' }, 'Dominant palette'),
        swatchList,
        paletteActions,
      ),
    )

    stage.append(canvas, loupe)
    loupe.append(loupeCanvas, loupeReadout)
    loupe.hidden = true
    showCurrent(null)
    renderPalette([])
  },
}

export default tool
