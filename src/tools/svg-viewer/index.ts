import {
  actions,
  button,
  checkbox,
  copyRow,
  mediaFrame,
  note,
  panel,
  stat,
  stats,
  textarea,
  toolLayout,
} from '../../core/components'
import { download, readFileAsText } from '../../core/ui'
import type { Tool } from '../../core/types'
import { formatBytes, inspectSvg, looksLikeSvg, optimizeSvg, sanitizeSvg, svgCssUrl, svgDataUri } from './svg'

const SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6ee7b7"/>
      <stop offset="1" stop-color="#34d399"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="24" fill="url(#g)"/>
  <circle cx="80" cy="66" r="30" fill="#0e1116"/>
  <path d="M40 132 L80 92 L120 132 Z" fill="#0e1116"/>
</svg>`

const tool: Tool = {
  slug: 'svg-viewer',
  name: 'SVG Viewer & Cleaner',
  description: 'Preview SVG markup, see what is inside it, strip scripts, and copy a data URI or CSS url().',
  category: 'Design',
  icon: '◈',
  keywords: ['svg', 'vector', 'view', 'preview', 'sanitize', 'clean', 'data uri', 'css', 'icon', 'image'],
  render(root) {
    let raw = SAMPLE
    let optimize = false

    const frame = mediaFrame({ alt: 'SVG preview', checker: true, maxHeight: 300 })
    const warning = note('', 'warn')
    warning.hidden = true
    const status = document.createElement('p')
    status.className = 'ts-k-hint'

    const statsStrip = stats()
    const tagLine = document.createElement('p')
    tagLine.className = 'ts-k-hint'
    const optimizeLine = document.createElement('p')
    optimizeLine.className = 'ts-k-hint'
    const colors = document.createElement('div')
    colors.className = 'ts-k-colors'
    const useRows = document.createElement('div')
    useRows.className = 'ts-k-kvlist'

    const editor = textarea({ rows: 10, value: raw })

    /** The markup the tool hands out: sanitised, and optionally optimised. */
    function emittedMarkup(): string {
      const clean = sanitizeSvg(raw).markup
      return optimize ? optimizeSvg(clean).markup : clean
    }

    function renderOutputs() {
      const clean = sanitizeSvg(raw)
      const info = inspectSvg(raw)
      const optimized = optimize ? optimizeSvg(clean.markup) : null
      const emitted = emittedMarkup()

      frame.image.src = svgDataUri(emitted)
      status.textContent = `${info.width ?? '—'} × ${info.height ?? '—'}${info.width ? info.units : ''} · ${
        info.viewBox ? `viewBox ${info.viewBox.width}×${info.viewBox.height}` : 'no viewBox'
      } · ${info.elementCount} elements · ${formatBytes(info.sizeBytes)}`

      const notices: string[] = []
      if (info.hasScript) notices.push('script or event handler found')
      if (info.hasForeignObject) notices.push('foreignObject found')
      if (info.hasExternalRefs) notices.push('links to an external file')
      if (clean.removed.length) notices.push(`removed: ${clean.removed.join(', ')}`)
      if (notices.length) {
        warning.textContent = `Heads up — ${notices.join('; ')}.`
        warning.hidden = false
      } else {
        warning.hidden = true
      }

      statsStrip.replaceChildren(
        stat({ label: 'Elements', value: String(info.elementCount) }),
        stat({ label: 'Size', value: formatBytes(info.sizeBytes) }),
        stat({ label: 'Colours', value: String(info.colors.length) }),
        stat({ label: 'Removed', value: String(clean.removed.length) }),
      )

      tagLine.textContent = info.tags.length
        ? info.tags.map((entry) => `${entry.tag} ×${entry.count}`).join(', ')
        : 'No elements found.'

      colors.replaceChildren(
        ...(info.colors.length
          ? info.colors.map((color) =>
              colorChip(color),
            )
          : [Object.assign(document.createElement('span'), { className: 'ts-k-hint', textContent: 'No explicit colours — the SVG may use currentColor or CSS.' })]),
      )

      useRows.replaceChildren(
        copyRow('Data URI', svgDataUri(emitted)),
        copyRow('CSS', svgCssUrl(emitted)),
      )

      if (optimized) {
        const saved = optimized.before - optimized.after
        const percent = optimized.before === 0 ? 0 : Math.round((saved / optimized.before) * 100)
        const detail = optimized.steps.length ? ` — ${optimized.steps.join(', ')}` : ' — nothing left to remove'
        optimizeLine.textContent = `Optimised ${formatBytes(optimized.before)} → ${formatBytes(
          optimized.after,
        )} (${percent}% smaller)${detail}.`
      } else {
        optimizeLine.textContent = 'Turn on “Optimise output” to strip comments, metadata and spare whitespace.'
      }
    }

    function colorChip(color: string): HTMLElement {
      const chip = document.createElement('span')
      chip.className = 'ts-k-color'
      chip.title = color
      const swatch = document.createElement('span')
      swatch.className = 'ts-k-color__swatch'
      swatch.style.background = color
      const value = document.createElement('span')
      value.className = 'ts-k-color__value'
      value.textContent = color
      chip.append(swatch, value)
      return chip
    }

    editor.addEventListener('input', () => {
      raw = editor.value
      if (!looksLikeSvg(raw)) {
        warning.textContent = 'That does not look like SVG markup yet.'
        warning.hidden = false
        frame.image.removeAttribute('src')
        return
      }
      renderOutputs()
    })

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.svg,image/svg+xml'
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]
      if (!file) return
      raw = await readFileAsText(file)
      editor.value = raw
      renderOutputs()
    })

    function loadSample() {
      raw = SAMPLE
      editor.value = SAMPLE
      renderOutputs()
    }

    const optimizeToggle = checkbox({
      label: 'Optimise output',
      hint: 'Strip comments, metadata and spare whitespace',
      checked: false,
      onChange: (checked) => {
        optimize = checked
        renderOutputs()
      },
    })

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Markup', icon: 'code' },
          editor,
          actions(
            button('Load an SVG file', { icon: 'upload', onClick: () => fileInput.click() }),
            button('Load sample', { icon: 'refresh', onClick: loadSample }),
          ),
        ),
        panel(
          { title: 'Preview', icon: 'eye' },
          frame.root,
          status,
          optimizeToggle,
          optimizeLine,
          actions(
            button('Download cleaned SVG', {
              icon: 'download',
              onClick: () => download('cleaned.svg', emittedMarkup(), 'image/svg+xml'),
            }),
            button('Download data URI', {
              icon: 'download',
              onClick: () => download('svg-data-uri.txt', svgDataUri(emittedMarkup()), 'text/plain'),
            }),
          ),
        ),
        warning,
        panel({ title: 'What is inside', icon: 'layers' }, statsStrip, tagLine),
        panel({ title: 'Colours', icon: 'palette' }, colors),
        panel({ title: 'Use it', icon: 'copy' }, useRows),
        note('The preview is rendered as an image, so scripts never run. Scripts, event handlers and javascript: links are removed from the copyable output.'),
      ),
    )

    loadSample()
  },
}

export default tool
