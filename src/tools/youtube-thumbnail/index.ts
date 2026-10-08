import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { isPlaceholder, parseVideoId, shortUrl, thumbnailFilename, thumbnailsFor, watchUrl, type Thumbnail } from './youtube'

const SAMPLE = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

const tool: Tool = {
  slug: 'youtube-thumbnail',
  name: 'YouTube Thumbnail Grabber',
  description: 'Paste any YouTube link and grab every thumbnail size — copy the URL or download the image.',
  category: 'Media',
  keywords: ['youtube', 'thumbnail', 'grabber', 'downloader', 'video', 'cover image', 'yt', 'shorts'],
  render(root) {
    const input = el('input', {
      class: 'ts-input',
      type: 'text',
      spellcheck: false,
      placeholder: 'Paste a YouTube link or video ID…',
      'aria-label': 'YouTube video link or id',
      value: SAMPLE,
    }) as HTMLInputElement

    const warning = el('p', { class: 'ts-error', hidden: true })
    const summary = el('div', { class: 'ts-yt-summary' })
    const grid = el('div', { class: 'ts-yt-grid' })

    let currentId = ''

    function fail(message: string) {
      warning.textContent = message
      warning.hidden = false
    }

    /** Draw the image to a canvas and export a JPEG blob, so the file lands locally. */
    async function downloadThumbnail(thumbnail: Thumbnail, button: HTMLButtonElement) {
      const original = button.textContent
      button.disabled = true
      button.textContent = 'Fetching…'
      try {
        const response = await fetch(thumbnail.url, { mode: 'cors', cache: 'force-cache' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const blob = await response.blob()
        const bitmap = await createImageBitmap(blob)
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('no canvas context')
        context.drawImage(bitmap, 0, 0)
        bitmap.close()
        const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95))
        if (!jpeg) throw new Error('could not encode image')
        const url = URL.createObjectURL(jpeg)
        const link = el('a', { href: url, download: thumbnailFilename(currentId, thumbnail.name) }) as HTMLAnchorElement
        document.body.append(link)
        link.click()
        link.remove()
        // Revoke on the next tick so the download has started.
        setTimeout(() => URL.revokeObjectURL(url), 4000)
      } catch {
        // The bytes could not be read, but the browser can still save the URL.
        const link = el('a', {
          href: thumbnail.url,
          download: thumbnailFilename(currentId, thumbnail.name),
          target: '_blank',
          rel: 'noopener noreferrer',
        }) as HTMLAnchorElement
        document.body.append(link)
        link.click()
        link.remove()
      } finally {
        button.disabled = false
        button.textContent = original
      }
    }

    function renderThumbnails(id: string) {
      const list = thumbnailsFor(id)
      grid.replaceChildren(
        ...list.map((thumbnail) => {
          const image = el('img', {
            class: 'ts-yt-image',
            src: thumbnail.url,
            alt: `${thumbnail.label} thumbnail`,
            loading: 'lazy',
            referrerpolicy: 'no-referrer',
          }) as HTMLImageElement

          const status = el('span', { class: 'ts-yt-status' })
          const meta = el(
            'div',
            { class: 'ts-yt-meta' },
            el('span', { class: 'ts-yt-label' }, thumbnail.label),
            el('span', { class: 'ts-yt-dim' }, `${thumbnail.width}×${thumbnail.height} · ${thumbnail.aspect}`),
          )
          const actions = el('div', { class: 'ts-yt-actions' })

          const downloadButton = el(
            'button',
            { type: 'button', class: 'ts-button ts-button-primary' },
            'Download',
          ) as HTMLButtonElement
          downloadButton.addEventListener('click', () => void downloadThumbnail(thumbnail, downloadButton))

          actions.append(copyChip(() => thumbnail.url, 'Copy URL'), downloadButton)

          const card = el('figure', { class: 'ts-yt-card' }, el('div', { class: 'ts-yt-frame' }, image, status), meta, actions)

          image.addEventListener('load', () => {
            if (isPlaceholder(image.naturalWidth, image.naturalHeight)) {
              card.classList.add('is-missing')
              status.textContent = 'Not available'
              downloadButton.disabled = true
              downloadButton.title = 'This video has no thumbnail at this size'
            } else {
              status.textContent = ''
            }
          })
          image.addEventListener('error', () => {
            card.classList.add('is-missing')
            status.textContent = 'Not available'
            downloadButton.disabled = true
          })

          return card
        }),
      )
    }

    function renderSummary(id: string) {
      summary.replaceChildren(
        el('span', { class: 'ts-muted' }, 'Video ID'),
        el('span', { class: 'ts-yt-id' }, id),
        copyChip(() => watchUrl(id), 'Copy watch link'),
        copyChip(() => shortUrl(id), 'Copy short link'),
      )
    }

    function update() {
      warning.hidden = true
      const id = parseVideoId(input.value)
      if (!id) {
        currentId = ''
        summary.replaceChildren()
        grid.replaceChildren()
        if (input.value.trim() !== '') fail('That does not look like a YouTube link or video ID.')
        return
      }
      currentId = id
      renderSummary(id)
      renderThumbnails(id)
    }

    input.addEventListener('input', update)

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el(
          'div',
          { class: 'ts-field' },
          el('label', {}, 'YouTube link or video ID'),
          el('div', { class: 'ts-yt-input-row' }, input, el('button', { type: 'button', class: 'ts-button', onclick: () => { input.value = ''; update(); input.focus() } }, 'Clear')),
          warning,
        ),
        summary,
        grid,
        el(
          'p',
          { class: 'ts-yt-note' },
          'Thumbnails are served from i.ytimg.com, so your browser fetches them directly from YouTube — toolspace never sees your link, and nothing is proxied. Downloading reads the image on a canvas and saves it locally; if the image cannot be read, the download falls back to the raw URL.',
        ),
      ),
    )

    update()
  },
}

export default tool
