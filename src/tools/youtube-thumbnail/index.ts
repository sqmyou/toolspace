import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import {
  bestAvailable,
  isPlaceholder,
  parseVideoId,
  qualityByName,
  shortUrl,
  thumbnailFilename,
  thumbnailsFor,
  watchUrl,
  type Thumbnail,
} from './youtube'

const SAMPLE = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

const tool: Tool = {
  slug: 'youtube-thumbnail',
  name: 'YouTube Thumbnail Grabber',
  description: 'Paste any YouTube link, pick a size and grab that thumbnail — copy the URL or download the image.',
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
    const picker = el('div', { class: 'ts-yt-picker', role: 'radiogroup', 'aria-label': 'Thumbnail size' })
    const panel = el('div', { class: 'ts-yt-panel' })

    let currentId = ''
    let selected = 'maxresdefault'
    /** Which sizes this video actually has. Unknown until an image decodes. */
    const available: Record<string, boolean> = {}

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

    /** Draw the size picker, then the preview for whichever size is selected. */
    function renderPicker() {
      picker.replaceChildren(
        ...thumbnailsFor(currentId).map((thumbnail) => {
          const on = thumbnail.name === selected
          const missing = available[thumbnail.name] === false
          const button = el(
            'button',
            {
              type: 'button',
              class: 'ts-yt-option',
              role: 'radio',
              'aria-checked': on ? 'true' : 'false',
              disabled: missing,
              title: missing ? 'This video has no thumbnail at this size' : thumbnail.note,
              onclick: () => {
                selected = thumbnail.name
                renderPicker()
                renderPanel()
              },
            },
            el('span', { class: 'ts-yt-option-label' }, thumbnail.label),
            el('span', { class: 'ts-yt-option-dim' }, `${thumbnail.width}×${thumbnail.height}`),
          )
          if (on) button.classList.add('is-on')
          if (missing) button.classList.add('is-missing')
          return button
        }),
      )
    }

    function renderPanel() {
      const thumbnail = qualityByName(selected)
      if (!thumbnail) return
      const url = thumbnailsFor(currentId).find((t) => t.name === selected)!.url

      const image = el('img', {
        class: 'ts-yt-image',
        src: url,
        alt: `${thumbnail.label} thumbnail`,
        referrerpolicy: 'no-referrer',
      }) as HTMLImageElement

      const status = el('span', { class: 'ts-yt-status' })
      const downloadButton = el(
        'button',
        { type: 'button', class: 'ts-button ts-primary' },
        'Download',
      ) as HTMLButtonElement
      downloadButton.addEventListener('click', () => void downloadThumbnail({ ...thumbnail, url }, downloadButton))

      const actions = el('div', { class: 'ts-yt-actions' }, copyChip(() => url, 'Copy URL'), downloadButton)

      image.addEventListener('load', () => {
        const missing = isPlaceholder(image.naturalWidth, image.naturalHeight)
        available[thumbnail.name] = !missing
        if (missing) {
          status.textContent = 'Not available at this size'
          downloadButton.disabled = true
          downloadButton.title = 'This video has no thumbnail at this size'
          panel.classList.add('is-missing')
          // Move to the best size that does exist rather than sit on a blank one.
          const fallback = bestAvailable(available)
          if (fallback !== selected) {
            selected = fallback
            renderPicker()
            renderPanel()
            return
          }
        } else {
          panel.classList.remove('is-missing')
          downloadButton.disabled = false
          downloadButton.removeAttribute('title')
        }
        renderPicker()
      })
      image.addEventListener('error', () => {
        available[thumbnail.name] = false
        panel.classList.add('is-missing')
        status.textContent = 'Not available at this size'
        downloadButton.disabled = true
        renderPicker()
      })

      panel.replaceChildren(
        el('div', { class: 'ts-yt-frame' }, image, status),
        el(
          'div',
          { class: 'ts-yt-detail' },
          el(
            'div',
            { class: 'ts-yt-meta' },
            el('span', { class: 'ts-yt-label' }, thumbnail.label),
            el(
              'span',
              { class: 'ts-yt-dim' },
              `${thumbnail.width}×${thumbnail.height} · ${thumbnail.aspect} · ${thumbnail.note}`,
            ),
          ),
          actions,
        ),
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
        picker.replaceChildren()
        panel.replaceChildren()
        if (input.value.trim() !== '') fail('That does not look like a YouTube link or video ID.')
        return
      }
      // A new video invalidates everything we knew about the old one's sizes.
      if (id !== currentId) {
        currentId = id
        for (const key of Object.keys(available)) delete available[key]
        selected = 'maxresdefault'
      }
      renderSummary(id)
      renderPicker()
      renderPanel()
    }

    input.addEventListener('input', update)

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-field' },
          el('label', {}, 'YouTube link or video ID'),
          el(
            'div',
            { class: 'ts-yt-input-row' },
            input,
            el(
              'button',
              { type: 'button', class: 'ts-button', onclick: () => { input.value = ''; update(); input.focus() } },
              'Clear',
            ),
          ),
          warning,
        ),
        summary,
        picker,
        panel,
        el(
          'p',
          { class: 'ts-yt-note' },
          'Pick a size, then copy its URL or download the image. Thumbnails are served from i.ytimg.com, so your browser fetches them directly from YouTube — toolspace never sees your link, and nothing is proxied. Downloading reads the image on a canvas and saves it locally; if the image cannot be read, the download falls back to the raw URL.',
        ),
      ),
    )

    update()
  },
}

export default tool
