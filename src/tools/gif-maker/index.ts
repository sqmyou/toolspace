import {
  actions,
  badge,
  button,
  checkbox,
  dropzone,
  field,
  mediaFrame,
  note,
  panel,
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
  encodeGif,
  flattenTransparency,
  frameDelay,
  medianCut,
  quantize,
  type GifOptions,
  type IndexedFrame,
  type Rgb,
} from './gif'

const MAX_CANVAS = 800
const FRAME_BUDGET = 600

interface LoadedVideo {
  file: File
  video: HTMLVideoElement
  duration: number
  width: number
  height: number
}

/** Decode a colour string through the canvas, so `#hex` and `rgb()` both work. */
function parseColor(value: string): Rgb {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d')
  if (!context) return { r: 0, g: 0, b: 0 }
  context.fillStyle = '#000000'
  context.fillStyle = value
  context.fillRect(0, 0, 1, 1)
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data
  return { r, g, b }
}

function seek(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener('seeked', done)
      resolve()
    }
    video.addEventListener('seeked', done)
    video.currentTime = time
  })
}

const tool: Tool = {
  slug: 'gif-maker',
  name: 'GIF Maker',
  description: 'Turn a video into an animated GIF in your browser — trim, resize, set the frame rate and colours.',
  category: 'Media',
  keywords: [
    'gif', 'animate', 'animation', 'video', 'mp4', 'webm', 'convert', 'frames',
    'loop', 'palette', 'quantise', 'boomerang', 'encoder',
  ],
  render(root) {
    let source: LoadedVideo | null = null
    let gifBlob: Blob | null = null
    let previewUrl = ''
    let busy = false

    // Settings, all defaulted to something that produces a small, watchable file.
    let startAt = 0
    let endAt = 0
    let fps = 12
    let width = 480
    let speed = 1
    let loopForever = true
    let pingPong = false
    let loopCount = 3
    let colorCount = 128
    let transparent = false
    let matte = '#000000'
    let dither = true

    const status = note('Choose a video to begin.')
    const warning = note('', 'danger')
    warning.hidden = true
    const progress = document.createElement('p')
    progress.className = 'ts-k-hint'

    const meta = stats()
    const paletteStrip = document.createElement('div')
    paletteStrip.className = 'ts-k-palette'
    const sizeStats = stats()

    const preview = mediaFrame({ alt: 'GIF preview', maxHeight: 360 })
    const capNotice = document.createElement('p')
    capNotice.className = 'ts-k-hint'

    const numberField = (value: string, min = '0') => {
      const input = textField({ type: 'number', value })
      input.setAttribute('min', min)
      return input
    }

    const loopCountInput = numberField('3', '1')
    loopCountInput.addEventListener('input', () => {
      loopCount = Math.max(1, Number(loopCountInput.value) || 1)
    })

    const startInput = numberField('0')
    const endInput = numberField('0')
    const widthInput = numberField('480', '16')

    const fpsSlider = slider({
      label: 'Frames per second',
      min: 5,
      max: 30,
      value: fps,
      format: (value) => `${value} fps`,
      onInput: (value) => {
        fps = value
        readForm()
      },
    })
    const speedSlider = slider({
      label: 'Playback speed',
      min: 50,
      max: 200,
      step: 25,
      value: 100,
      format: (value) => `${(value / 100).toFixed(2)}×`,
      onInput: (value) => {
        speed = value / 100
        readForm()
      },
    })
    const colorsSlider = slider({
      label: 'Colours',
      min: 8,
      max: 256,
      step: 8,
      value: colorCount,
      format: (value) => `${value}`,
      onInput: (value) => {
        colorCount = value
        readForm()
      },
    })

    const loopToggle = checkbox({ label: 'Loop forever', checked: true })
    const pingPongToggle = checkbox({ label: 'Ping-pong (forward then back)' })
    const ditherToggle = checkbox({ label: 'Dither (smoother gradients, larger file)', checked: true })

    const transparentToggle = checkbox({
      label: 'Replace a flat studio background with transparency',
      onChange: () => {
        readForm()
      },
    })
    const matteField = textField({ value: matte, mono: true })
    matteField.addEventListener('input', () => {
      matte = matteField.value
    })

    const makeButton = button('Make GIF', { variant: 'primary', icon: 'play', onClick: () => void make() })
    const downloadButton = button('Download GIF', {
      variant: 'primary',
      icon: 'download',
      onClick: () => {
        if (gifBlob) download(gifName(), gifBlob, 'image/gif')
      },
    })
    downloadButton.disabled = true
    makeButton.disabled = true

    function gifName(): string {
      const base = source?.file.name.replace(/\.[^.]+$/, '') || 'animation'
      return `${base}.gif`
    }

    function readForm(): void {
      width = Math.max(16, Math.min(MAX_CANVAS, Math.floor(Number(widthInput.value) || 480)))
      startAt = Math.max(0, Number(startInput.value) || 0)
      endAt = source ? Math.min(source.duration, Number(endInput.value) || source.duration) : 0
      if (source && endAt <= startAt) endAt = source.duration
      const forever = (loopToggle.querySelector('input') as HTMLInputElement).checked
      loopForever = forever
      pingPong = (pingPongToggle.querySelector('input') as HTMLInputElement).checked
      dither = (ditherToggle.querySelector('input') as HTMLInputElement).checked
      transparent = (transparentToggle.querySelector('input') as HTMLInputElement).checked
      renderPlan()
    }

    function spanSeconds(): number {
      return Math.max(0, endAt - startAt)
    }

    function renderPlan(): void {
      if (!source) return
      const wanted = Math.max(1, Math.round(spanSeconds() * fps))
      const capped = Math.min(wanted, FRAME_BUDGET)
      const shown = pingPong ? Math.min(capped * 2, FRAME_BUDGET * 2) : capped
      const height = Math.max(1, Math.round((width * source.height) / source.width))
      capNotice.textContent =
        wanted > FRAME_BUDGET
          ? `That range at ${fps} fps is ${wanted} frames; the first ${capped} are used to keep the encode sane. Lower the rate or the range for the whole clip.`
          : `${shown} frames at ${width}×${height} — about ${((shown * width * height) / 1e6).toFixed(1)} megapixels to encode.`
    }

    /* ------------------------------------------------------------------ load */

    const picker = dropzone({
      label: 'Drop a video here',
      hint: 'MP4 or WebM',
      accept: 'video/*',
      icon: 'play',
      onFiles: () => {},
      onBuffers: async (buffers, files) => {
        const file = files[0]
        if (!file.type.startsWith('video/')) {
          warning.textContent = 'That is not a video file.'
          warning.hidden = false
          return
        }
        warning.hidden = true
        status.textContent = 'Reading…'
        const video = document.createElement('video')
        video.muted = true
        video.playsInline = true
        video.preload = 'auto'
        const url = URL.createObjectURL(new Blob([buffers[0]], { type: file.type }))
        video.src = url
        try {
          await new Promise<void>((resolve, reject) => {
            video.addEventListener('loadedmetadata', () => resolve(), { once: true })
            video.addEventListener('error', () => reject(new Error('decode')), { once: true })
          })
        } catch {
          warning.textContent = 'That video could not be decoded by this browser.'
          warning.hidden = false
          status.textContent = ''
          return
        }
        source = {
          file,
          video,
          duration: Number.isFinite(video.duration) ? video.duration : 0,
          width: video.videoWidth,
          height: video.videoHeight,
        }
        startAt = 0
        endAt = source.duration || 1
        startInput.value = '0'
        endInput.value = endAt.toFixed(2)
        widthInput.value = String(Math.min(480, source.width))
        status.textContent = `${file.name} · ${source.width}×${source.height} · ${source.duration.toFixed(2)}s`
        meta.replaceChildren(
          stat({ label: 'Source', value: `${source.width}×${source.height}` }),
          stat({ label: 'Duration', value: `${source.duration.toFixed(2)}s` }),
          stat({ label: 'Type', value: file.type.replace('video/', '') }),
        )
        makeButton.disabled = false
        readForm()
      },
    })

    /* ----------------------------------------------------------------- build */

    /** Sample one frame, optionally punching out a flat background. */
    function grabFrame(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement): Uint8ClampedArray {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
      if (!transparent) return flattenTransparency(pixels.data, parseColor(matte))
      const background = flatBackgroundColor(pixels.data)
      if (!background) return pixels.data
      return keyOut(pixels.data, background)
    }

    /**
     * The most common colour around the frame's border. A studio backdrop is
     * flat and touches every edge, so this is a reliable guess at "the thing to
     * remove" without asking the user to pick a pixel.
     */
    function flatBackgroundColor(rgba: Uint8ClampedArray): Rgb | null {
      const counts = new Map<number, number>()
      const sample = (x: number, y: number) => {
        const offset = (y * width + x) * 4
        if (rgba[offset + 3] < 200) return
        const key = (rgba[offset] << 16) | (rgba[offset + 1] << 8) | rgba[offset + 2]
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      for (let x = 0; x < width; x += 2) {
        sample(x, 0)
        sample(x, height - 1)
      }
      for (let y = 0; y < height; y += 2) {
        sample(0, y)
        sample(width - 1, y)
      }
      let best = -1
      let bestCount = 0
      for (const [key, count] of counts) {
        if (count > bestCount) {
          bestCount = count
          best = key
        }
      }
      const total = (width / 2) * 2 + (height / 2) * 2
      if (best < 0 || bestCount < total * 0.35) return null
      return { r: (best >> 16) & 0xff, g: (best >> 8) & 0xff, b: best & 0xff }
    }

    /** Clear pixels within a small tolerance of the keyed colour. */
    function keyOut(rgba: Uint8ClampedArray, key: Rgb, tolerance = 48): Uint8ClampedArray {
      const out = new Uint8ClampedArray(rgba.length)
      out.set(rgba)
      for (let p = 0; p < rgba.length; p += 4) {
        const dr = rgba[p] - key.r
        const dg = rgba[p + 1] - key.g
        const db = rgba[p + 2] - key.b
        if (dr * dr + dg * dg + db * db <= tolerance * tolerance) out[p + 3] = 0
      }
      return out
    }

    let height = 1

    async function make(): Promise<void> {
      if (!source || busy) return
      readForm()
      busy = true
      makeButton.disabled = true
      downloadButton.disabled = true
      warning.hidden = true
      gifBlob = null

      const canvas = document.createElement('canvas')
      canvas.width = width
      height = Math.max(1, Math.round((width * source.height) / source.width))
      canvas.height = height
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) {
        warning.textContent = 'Could not get a 2D canvas context.'
        warning.hidden = false
        busy = false
        makeButton.disabled = false
        return
      }

      const wanted = Math.max(1, Math.round(spanSeconds() * fps))
      const total = Math.min(wanted, FRAME_BUDGET)
      const step = spanSeconds() / total
      const frames: Uint8ClampedArray[] = []

      const histogram = new Map<number, number>()
      const sampleInto = (rgba: Uint8ClampedArray) => {
        // Every pixel of every frame would swamp the count; a stride keeps the
        // palette statistically the same while staying fast on long clips.
        for (let p = 0; p < rgba.length; p += 4 * 3) {
          if (rgba[p + 3] === 0) continue
          const key = (rgba[p] << 16) | (rgba[p + 1] << 8) | rgba[p + 2]
          histogram.set(key, (histogram.get(key) ?? 0) + 1)
        }
      }

      try {
        for (let i = 0; i < total; i += 1) {
          progress.textContent = `Sampling frame ${i + 1} of ${total}…`
          await seek(source.video, Math.min(startAt + i * step, Math.max(0, source.duration - 0.001)))
          context.clearRect(0, 0, width, height)
          context.drawImage(source.video, 0, 0, width, height)
          const rgba = grabFrame(context, canvas)
          frames.push(rgba)
          sampleInto(rgba)
        }

        progress.textContent = 'Choosing colours…'
        const palette = medianCut(histogram, colorCount)
        renderPalette(palette)

        progress.textContent = 'Encoding…'
        const delay = frameDelay(fps * speed)
        const indexed: IndexedFrame[] = frames.map((rgba) => ({
          indices: quantize(rgba, palette, width, height, dither),
          delay,
        }))
        const ordered = pingPong && indexed.length > 1 ? [...indexed, ...indexed.slice(1, -1).reverse()] : indexed

        const options: GifOptions = { width, height, palette }
        if (loopForever) options.loop = 0
        else if (loopCount > 1) options.loop = loopCount - 1

        const bytes = encodeGif(ordered, options)
        gifBlob = new Blob([bytes as unknown as BlobPart], { type: 'image/gif' })
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        previewUrl = URL.createObjectURL(gifBlob)
        preview.image.src = previewUrl

        const sourceBytes = frames.length * width * height
        sizeStats.replaceChildren(
          stat({ label: 'Frames', value: String(ordered.length) }),
          stat({ label: 'Size', value: `${width}×${height}`, hint: `${(gifBlob.size / 1024).toFixed(0)} KB` }),
          stat({
            label: 'Compression',
            value: `${Math.max(1, Math.round(sourceBytes / gifBlob.size))}×`,
            hint: `from ${(sourceBytes / 1048576).toFixed(1)} MB raw`,
          }),
        )
        progress.textContent = 'Done.'
        downloadButton.disabled = false
      } catch (error) {
        warning.textContent = error instanceof Error ? error.message : 'Encoding failed.'
        warning.hidden = false
        progress.textContent = ''
      } finally {
        busy = false
        makeButton.disabled = false
      }
    }

    function renderPalette(palette: Rgb[]): void {
      paletteStrip.replaceChildren(
        ...palette.slice(0, 64).map((entry) => {
          const chip = document.createElement('span')
          chip.className = 'ts-gif-swatch'
          chip.style.background = `rgb(${entry.r} ${entry.g} ${entry.b})`
          chip.title = `rgb(${entry.r} ${entry.g} ${entry.b})`
          return chip
        }),
        badge(`${palette.length} colours`),
      )
    }

    for (const input of [startInput, endInput, widthInput, loopToggle, pingPongToggle, ditherToggle]) {
      input.addEventListener('input', readForm)
    }

    root.append(
      toolLayout(
        { wide: true },
        panel({ title: 'Source', icon: 'play' }, picker.root, status, warning),
        panel(
          { title: 'Range & size', icon: 'ruler' },
          meta,
          actions(
            field(startInput, { label: 'Start (s)', grow: true }),
            field(endInput, { label: 'End (s)', grow: true }),
            field(widthInput, { label: 'Width (px)', grow: true }),
          ),
          actions(
            button('Full length', {
              icon: 'refresh',
              onClick: () => {
                startInput.value = '0'
                endInput.value = (source?.duration ?? 0).toFixed(2)
                readForm()
              },
            }),
            button('Trim to 3s', {
              icon: 'filter',
              onClick: () => {
                endInput.value = String(Math.min(3, (source?.duration ?? 3)).toFixed(2))
                readForm()
              },
            }),
          ),
        ),
        panel(
          { title: 'Animation', icon: 'sliders' },
          fpsSlider,
          speedSlider,
          colorsSlider,
          loopToggle,
          field(loopCountInput, { label: 'Loop count (when not forever)' }),
          pingPongToggle,
          ditherToggle,
          field(matteField, { label: 'Matte / key colour', hint: 'Used to flatten transparency, or as the colour removed from a flat backdrop.' }),
          transparentToggle,
          capNotice,
        ),
        panel(
          { title: 'Preview', icon: 'eye' },
          split(
            field(preview.root, { label: 'Animated result' }),
            field(paletteStrip, { label: 'Palette' }),
          ),
          sizeStats,
          progress,
          actions(makeButton, downloadButton),
        ),
        note('Frames are sampled from the video and encoded by a GIF writer that runs in this tab. Nothing is uploaded.'),
      ),
    )

    readForm()
  },
}

export default tool
