import {
  actions,
  button,
  copyRow,
  dropzone,
  mediaFrame,
  note,
  panel,
  stats,
  stat,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
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

    const frame = mediaFrame({ alt: 'Image to sample', maxHeight: 460 })
    // The canvas is the visible preview; the frame's <img> is unused here.
    frame.image.hidden = true
    const canvas = el('canvas', { class: 'ts-picker-canvas' }) as HTMLCanvasElement
    const loupe = el('div', { class: 'ts-loupe', hidden: true })
    const loupeCanvas = el('canvas', { class: 'ts-loupe-canvas', width: '1', height: '1' }) as HTMLCanvasElement
    const loupeReadout = el('div', { class: 'ts-loupe-readout' })

    const status = note('Choose an image, or drop one anywhere on this panel.')
    const warning = note('', 'danger')
    warning.hidden = true

    const pickedPanel = el('div', { class: 'ts-picked' })
    const paletteStrip = stats()
    const swatchList = el('div', { class: 'ts-swatch-grid' })
    const paletteActions = actions()

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
          : el('span', { class: 'ts-k-hint' }, 'Outside the image'),
      )
    }

    function showCurrent(sample: Sample | null, label = 'Picked colour') {
      if (!sample) {
        pickedPanel.replaceChildren(el('p', { class: 'ts-k-hint' }, 'Hover the image to sample a colour, then click or tap to pin it.'))
        return
      }
      const hsl = rgbToHsl(sample.rgb)
      pickedPanel.replaceChildren(
        el('div', { class: 'ts-picked-chip', style: `background:${sample.hex}` }),
        el(
          'div',
          { class: 'ts-picked-meta' },
          el('span', { class: 'ts-picked-label' }, label),
          copyRow('HEX', sample.hex.toUpperCase()),
          copyRow('RGB', formatRgb(sample.rgb)),
          copyRow('HSL', formatHsl(hsl)),
          copyRow('Contrast vs white', `${contrastWithWhite(sample.rgb).toFixed(2)}:1`, { copy: false }),
        ),
      )
    }

    function renderPalette(samples: Sample[]) {
      if (samples.length === 0) {
        paletteStrip.replaceChildren()
        swatchList.replaceChildren(el('p', { class: 'ts-k-hint' }, 'Load an image to see its palette.'))
        paletteActions.replaceChildren()
        return
      }
      paletteStrip.replaceChildren(
        stat({ label: 'Colours', value: String(samples.length) }),
        stat({ label: 'Top colour', value: samples[0].hex.toUpperCase() }),
      )
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
        button('Copy CSS variables', { size: 'sm', onClick: () => void navigator.clipboard?.writeText(paletteToCss(samples)) }),
        button('Copy hex list', { size: 'sm', onClick: () => void navigator.clipboard?.writeText(paletteToList(samples)) }),
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
      const sample = pixelAt(x, y)
      loupe.hidden = false
      loupe.style.transform = `translate(${event.clientX + 16}px, ${event.clientY + 16}px)`
      paintLoupe(x, y, sample)
    })
    canvas.addEventListener('pointerleave', () => {
      loupe.hidden = true
    })
    canvas.addEventListener('pointerdown', (event) => {
      const { x, y } = toCanvasPoint(event)
      const sample = pixelAt(x, y)
      if (sample) showCurrent(sample)
    })

    const drop = dropzone({
      label: 'Drop an image here',
      hint: 'PNG, JPEG, WebP, GIF or SVG',
      accept: 'image/*',
      icon: 'image',
      onFiles: (files) => {
        const file = files[0]
        if (!file) return
        if (file.type && !file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.svg')) {
          fail('That file is not an image.')
          return
        }
        load(file)
      },
    })

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'Image', icon: 'uploadCloud' }, drop.root, status, warning, frame.root),
        panel({ title: 'Picked colour', icon: 'pipette' }, pickedPanel),
        panel({ title: 'Dominant palette', icon: 'palette' }, paletteStrip, swatchList, paletteActions),
        note('Sampling and palette extraction run on a canvas in this tab. The image is never uploaded.'),
      ),
    )

    frame.root.append(canvas)
    loupe.append(loupeCanvas, loupeReadout)
    // The loupe is fixed to the viewport and the frame clips its contents.
    document.body.append(loupe)

    showCurrent(null)
    renderPalette([])
  },
}

export default tool
