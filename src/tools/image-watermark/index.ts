import { actions, button, checkbox, colorField, dropzone, field, note, panel, section, segmented, select, slider, stat, textarea, toolLayout } from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { download } from '../../core/ui'
import {
  ANCHORS,
  type Anchor,
  type WatermarkConfig,
  DEFAULT_CONFIG,
  planWatermark,
  resolveLogoSize,
  splitLines,
  textBlockSize,
} from './watermark'

type Format = 'image/png' | 'image/jpeg' | 'image/webp'

interface Loaded {
  image: HTMLImageElement
  name: string
  bytes: number
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not decode that image'))
    }
    image.src = url
  })
}

const tool: Tool = {
  slug: 'image-watermark',
  name: 'Image Watermark',
  description: 'Stamp text or a logo onto any image — nine corner positions or a tiled grid, with rotation, opacity, colour and full-resolution export.',
  category: 'Media',
  keywords: ['watermark', 'logo', 'brand', 'copyright', 'stamp', 'overlay', 'protect', 'photo', 'batch'],
  render(root) {
    const config: WatermarkConfig = { ...DEFAULT_CONFIG }
    let source: Loaded | null = null
    let logo: HTMLImageElement | null = null
    let logoName = ''
    let format: Format = 'image/png'

    const canvas = el('canvas', { class: 'ts-wm-canvas' }) as HTMLCanvasElement
    const stage = el('div', { class: 'ts-wm-stage' }, el('p', { class: 'ts-wm-empty' }, 'Choose an image to start.'))
    const metaRow = el('div', { class: 'ts-wm-meta' })

    const textArea = textarea({ rows: 2, value: config.text, onInput: (value) => { config.text = value; render() } })
    const textControls = el('div', { class: 'ts-wm-text' })

    const logoDrop = dropzone({
      label: 'Drop a logo (PNG with transparency works best)',
      accept: 'image/*',
      onFiles: async (files) => {
        const file = files[0]
        if (!file) return
        logo = await loadImage(file)
        logoName = file.name
        logoTitle.textContent = `Logo — ${logoName}`
        config.mode = 'image'
        modeControl.setValue('image')
        paintControls()
        render()
      },
    })
    const logoControls = el('div', { class: 'ts-wm-logo' }, logoDrop.root)

    const color = colorField({
      label: 'Colour',
      value: config.color,
      onInput: (value) => {
        if (/^#[0-9a-f]{6}$/i.test(value)) {
          config.color = value
          render()
        }
      },
    })

    const strokeColor = colorField({
      label: 'Outline colour',
      value: config.strokeColor,
      onInput: (value) => {
        if (/^#[0-9a-f]{6}$/i.test(value)) {
          config.strokeColor = value
          render()
        }
      },
    })

    const fontSlider = slider({ label: 'Size', min: 1, max: 30, value: config.fontScale, format: (v) => `${v}%`, onInput: (v) => { config.fontScale = v; render() } })
    const opacitySlider = slider({ label: 'Opacity', min: 5, max: 100, value: config.opacity * 100, format: (v) => `${v}%`, onInput: (v) => { config.opacity = v / 100; render() } })
    const rotationSlider = slider({ label: 'Rotation', min: -90, max: 90, value: config.rotation, format: (v) => `${v}°`, onInput: (v) => { config.rotation = v; render() } })
    const paddingSlider = slider({ label: 'Padding', min: 0, max: 20, value: config.padding, format: (v) => `${v}%`, onInput: (v) => { config.padding = v; render() } })
    const gapSlider = slider({ label: 'Tile gap', min: 0, max: 30, value: config.gap, format: (v) => `${v}%`, onInput: (v) => { config.gap = v; render() } })
    const strokeSlider = slider({ label: 'Outline', min: 0, max: 15, value: config.strokeWidth, format: (v) => `${v}%`, onInput: (v) => { config.strokeWidth = v; render() } })
    const logoSlider = slider({ label: 'Logo size', min: 3, max: 60, value: config.logoScale, format: (v) => `${v}%`, onInput: (v) => { config.logoScale = v; render() } })

    const boldBox = checkbox({ label: 'Bold', checked: config.bold, onChange: (v) => { config.bold = v; render() } })
    const italicBox = checkbox({ label: 'Italic', checked: config.italic, onChange: (v) => { config.italic = v; render() } })
    const tileBox = checkbox({ label: 'Tile across the image', checked: config.tiled, onChange: (v) => { config.tiled = v; render() } })

    const anchorButtons = new Map<Anchor, HTMLButtonElement>()
    const textStyleTitle = el('p', { class: 'ts-wm-subhead' }, 'Text')
    const logoTitle = el('p', { class: 'ts-wm-subhead' }, 'Logo')
    const anchorGrid = el('div', { class: 'ts-wm-anchors', role: 'radiogroup', 'aria-label': 'Position' })
    for (const anchor of ANCHORS) {
      const node = el('button', { class: 'ts-wm-anchor', type: 'button', role: 'radio', title: anchor.replace('-', ' '), 'aria-label': anchor.replace('-', ' ') }) as HTMLButtonElement
      node.addEventListener('click', () => {
        config.anchor = anchor
        config.tiled = false
        tileBox.querySelector('input')!.checked = false
        paintAnchor()
        render()
      })
      anchorButtons.set(anchor, node)
      anchorGrid.append(node)
    }

    const modeControl = segmented({
      label: 'Watermark kind',
      value: config.mode,
      items: [
        { value: 'text', label: 'Text' },
        { value: 'image', label: 'Logo' },
      ],
      onChange: (value) => {
        config.mode = value as 'text' | 'image'
        paintControls()
        render()
      },
    })

    const formatSelect = select({
      options: [
        { value: 'image/png', label: 'PNG (lossless)' },
        { value: 'image/jpeg', label: 'JPEG' },
        { value: 'image/webp', label: 'WebP' },
      ],
      value: format,
      onChange: (value) => { format = value as Format },
    })

    const downloadButton = button('Download image', { variant: 'primary', icon: 'download', onClick: exportImage })

    function paintControls() {
      textControls.replaceChildren()
      logoControls.replaceChildren()
      logoTitle.hidden = config.mode !== 'image'
      textStyleTitle.hidden = config.mode !== 'text'
      if (config.mode === 'text') {
        textControls.append(
          textStyleTitle,
          field(textArea, { label: 'Text — a new line makes a second line' }),
          fontSlider,
          opacitySlider,
          el('div', { class: 'ts-wm-grid' }, color.root, strokeColor.root),
          el('div', { class: 'ts-wm-checks' }, boldBox, italicBox),
          strokeSlider,
        )
      } else {
        logoControls.append(
          textStyleTitle,
          logoDrop.root,
          logoTitle,
          logoSlider,
          opacitySlider,
        )
      }
    }

    function paintAnchor() {
      anchorButtons.forEach((node, anchor) => {
        const on = !config.tiled && anchor === config.anchor
        node.classList.toggle('is-on', on)
        node.setAttribute('aria-checked', on ? 'true' : 'false')
      })
      anchorGrid.classList.toggle('is-off', config.tiled)
    }

    /** The mark box (width/height) for the current source and config. */
    function markSize(context: CanvasRenderingContext2D, canvasW: number, canvasH: number): { width: number; height: number; fontSize: number; base: number } {
      const base = Math.min(canvasW, canvasH)
      if (config.mode === 'image' && logo) {
        const size = resolveLogoSize(logo.naturalWidth, logo.naturalHeight, config.logoScale, canvasW)
        return { width: size.width, height: size.height, fontSize: 0, base }
      }
      const fontSize = Math.max(6, (config.fontScale / 100) * base)
      context.font = fontString(fontSize)
      const lines = splitLines(config.text || ' ')
      const widths = lines.map((line) => context.measureText(line).width)
      const size = textBlockSize(widths, lines.length, fontSize, config.lineHeight)
      return { width: Math.max(1, size.width), height: size.height, fontSize, base }
    }

    function fontString(fontSize: number): string {
      const style = config.italic ? 'italic ' : ''
      const weight = config.bold ? '700 ' : '400 '
      return `${style}${weight}${fontSize}px "IBM Plex Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif`
    }

    function render() {
      paintAnchor()
      if (!source) {
        stage.replaceChildren(el('p', { class: 'ts-wm-empty' }, 'Choose an image to start.'))
        metaRow.replaceChildren()
        downloadButton.disabled = true
        return
      }
      downloadButton.disabled = false
      const image = source.image
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')
      if (!context) return
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0)
      drawWatermark(context, canvas.width, canvas.height)
      stage.replaceChildren(el('div', { class: 'ts-wm-frame' }, canvas))
      metaRow.replaceChildren(
        stat({ label: 'Width', value: String(canvas.width) }),
        stat({ label: 'Height', value: String(canvas.height) }),
        stat({ label: 'File', value: source.name, hint: `${Math.round(source.bytes / 1024)} KB` }),
      )
    }

    function drawWatermark(context: CanvasRenderingContext2D, canvasW: number, canvasH: number) {
      const mark = markSize(context, canvasW, canvasH)
      const padPx = (config.padding / 100) * Math.min(canvasW, canvasH) * 0.5
      const gapPx = (config.gap / 100) * Math.min(canvasW, canvasH) * 0.5
      const placements = planWatermark({
        anchor: config.anchor,
        tiled: config.tiled,
        rotation: config.rotation,
        padding: padPx,
        gap: gapPx,
        canvasW,
        canvasH,
        markW: mark.width,
        markH: mark.height,
      })
      for (const placement of placements) {
        context.save()
        context.globalAlpha = config.mode === 'image' ? config.opacity : config.opacity
        const cx = placement.x + mark.width / 2
        const cy = placement.y + mark.height / 2
        context.translate(cx, cy)
        context.rotate((placement.rotation * Math.PI) / 180)
        if (config.mode === 'image' && logo) {
          context.drawImage(logo, -mark.width / 2, -mark.height / 2, mark.width, mark.height)
        } else {
          const lines = splitLines(config.text || ' ')
          const lineStep = mark.fontSize * config.lineHeight
          context.textAlign = 'left'
          context.textBaseline = 'top'
          context.font = fontString(mark.fontSize)
          const stroke = (config.strokeWidth / 100) * mark.fontSize
          lines.forEach((line, index) => {
            const x = -mark.width / 2
            const y = -mark.height / 2 + index * lineStep
            if (stroke > 0) {
              context.lineWidth = stroke
              context.lineJoin = 'round'
              context.strokeStyle = config.strokeColor
              context.strokeText(line, x, y)
            }
            context.fillStyle = config.color
            context.fillText(line, x, y)
          })
        }
        context.restore()
      }
    }

    function exportImage() {
      if (!source) return
      const context = canvas.getContext('2d')
      if (!context) return
      // JPEG has no alpha channel; cover the background so it does not go black.
      if (format === 'image/jpeg') {
        context.save()
        context.globalCompositeOperation = 'destination-over'
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.restore()
      }
      canvas.toBlob((blob) => {
        if (!blob) return
        const base = source!.name.replace(/\.[^.]+$/, '')
        const extension = format === 'image/png' ? 'png' : format === 'image/jpeg' ? 'jpg' : 'webp'
        download(`${base}-watermarked.${extension}`, blob)
      }, format, 0.92)
    }

    const imageDrop = dropzone({
      label: 'Drop an image here',
      hint: 'or',
      accept: 'image/*',
      onFiles: async (files) => {
        const file = files[0]
        if (!file) return
        try {
          const image = await loadImage(file)
          source = { image, name: file.name, bytes: file.size }
          render()
        } catch {
          stage.replaceChildren(el('p', { class: 'ts-wm-empty' }, 'That file could not be read as an image.'))
        }
      },
    })

    paintControls()
    paintAnchor()
    render()

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Image', icon: 'image' },
          imageDrop.root,
          metaRow,
          stage,
        ),
        panel(
          { title: 'Watermark', icon: 'pen' },
          modeControl,
          textControls,
          logoControls,
          el('p', { class: 'ts-wm-subhead' }, 'Placement'),
          rotationSlider,
          paddingSlider,
          tileBox,
          anchorGrid,
          gapSlider,
          actions(
            field(formatSelect, { label: 'Format' }),
            downloadButton,
          ),
        ),
        section(
          'About this tool',
          note('The canvas is drawn at the full resolution of your file, so the download is not a downscaled preview — everything happens in the tab and the image is never uploaded. Corner and centre placement use a nine-point grid; "tile" instead repeats the mark in a staggered pattern for a scrim across the whole photo. A transparent PNG logo keeps its transparency; JPEG exports are flattened onto white.'),
        ),
      ),
    )
  },
}

export default tool
