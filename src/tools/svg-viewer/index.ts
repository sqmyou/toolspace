import { el } from '../../core/dom'
import { copyChip, download, readFileAsText } from '../../core/ui'
import type { Tool } from '../../core/types'
import { formatBytes, inspectSvg, looksLikeSvg, sanitizeSvg, svgCssUrl, svgDataUri } from './svg'

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

    const previewFrame = el('div', { class: 'ts-svg-frame' })
    const preview = el('img', { class: 'ts-svg-preview', alt: 'SVG preview' }) as HTMLImageElement
    previewFrame.append(preview)

    const warning = el('p', { class: 'ts-error', hidden: true })
    const status = el('p', { class: 'ts-muted' })
    const stats = el('div', { class: 'ts-svg-stats' })
    const tagList = el('div', { class: 'ts-svg-tags' })
    const colorRow = el('div', { class: 'ts-svg-colors' })
    const uriRow = el('div', { class: 'ts-svg-out' })

    const editor = el('textarea', {
      class: 'ts-textarea',
      spellcheck: false,
      rows: 10,
      'aria-label': 'SVG markup',
    }) as HTMLTextAreaElement

    function renderOutputs() {
      const clean = sanitizeSvg(raw)
      const info = inspectSvg(raw)

      preview.src = svgDataUri(clean.markup)
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

      stats.replaceChildren(
        ...info.tags.slice(0, 6).map((entry) =>
          el(
            'div',
            { class: 'ts-svg-stat' },
            el('span', { class: 'ts-svg-stat-count' }, String(entry.count)),
            el('span', { class: 'ts-muted' }, entry.tag),
          ),
        ),
      )
      tagList.replaceChildren(
        el(
          'p',
          { class: 'ts-note' },
          info.tags.length
            ? info.tags.map((entry) => `${entry.tag} ×${entry.count}`).join(', ')
            : 'No elements found.',
        ),
      )

      colorRow.replaceChildren(
        ...(info.colors.length
          ? info.colors.map((color) =>
              el(
                'span',
                { class: 'ts-svg-color', title: color },
                el('span', { class: 'ts-svg-swatch', style: `background:${color}` }),
                el('span', { class: 'ts-svg-color-value' }, color),
              ),
            )
          : [el('span', { class: 'ts-muted' }, 'No explicit colours — the SVG may use currentColor or CSS.')]),
      )

      uriRow.replaceChildren(
        el(
          'div',
          { class: 'ts-copy-row' },
          el('span', { class: 'ts-muted' }, 'Data URI'),
          copyChip(() => svgDataUri(clean.markup), 'data:image/svg+xml,…'),
        ),
        el(
          'div',
          { class: 'ts-copy-row' },
          el('span', { class: 'ts-muted' }, 'CSS'),
          copyChip(() => svgCssUrl(clean.markup), 'url("data:image/svg+xml,…")'),
        ),
      )
    }

    editor.addEventListener('input', () => {
      raw = editor.value
      if (!looksLikeSvg(raw)) {
        warning.textContent = 'That does not look like SVG markup yet.'
        warning.hidden = false
        preview.removeAttribute('src')
        return
      }
      renderOutputs()
    })

    const fileInput = el('input', { type: 'file', accept: '.svg,image/svg+xml' }) as HTMLInputElement
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]
      if (!file) return
      raw = await readFileAsText(file)
      editor.value = raw
      renderOutputs()
    })

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-field ts-grow' }, el('label', {}, 'Load an SVG file'), fileInput),
          el('button', { class: 'ts-button', type: 'button', onclick: () => loadSample() }, 'Load sample'),
        ),
        el('div', { class: 'ts-svg-columns' },
          el('div', { class: 'ts-field' }, el('label', {}, 'Markup'), editor),
          el(
            'div',
            { class: 'ts-field' },
            el('label', {}, 'Preview'),
            previewFrame,
            el('div', { class: 'ts-svg-actions' },
              el('button', { class: 'ts-button', type: 'button', onclick: () => download('cleaned.svg', sanitizeSvg(raw).markup, 'image/svg+xml') }, 'Download cleaned SVG'),
              el('button', { class: 'ts-button', type: 'button', onclick: () => download('svg-data-uri.txt', svgDataUri(sanitizeSvg(raw).markup), 'text/plain') }, 'Download data URI'),
            ),
          ),
        ),
        status,
        warning,
        el('h3', { class: 'ts-subhead' }, 'What is inside'),
        stats,
        tagList,
        el('h3', { class: 'ts-subhead' }, 'Colours'),
        colorRow,
        el('h3', { class: 'ts-subhead' }, 'Use it'),
        uriRow,
        el(
          'p',
          { class: 'ts-note' },
          'The preview is rendered as an image, so scripts never run. Scripts, event handlers and javascript: links are removed from the copyable output. Nothing is uploaded.',
        ),
      ),
    )

    function loadSample() {
      raw = SAMPLE
      editor.value = SAMPLE
      renderOutputs()
    }

    loadSample()
  },
}

export default tool
