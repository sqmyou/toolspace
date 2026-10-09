import {
  button,
  chips,
  copyRow,
  imageBlock,
  note,
  panel,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
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
    const input = textField({
      value: SAMPLE,
      placeholder: 'Paste a YouTube link or video ID…',
      onInput: () => update(),
    })
    input.spellcheck = false
    input.setAttribute('aria-label', 'YouTube video link or id')

    const warning = note('', 'danger')
    warning.hidden = true
    const links = el('div', { class: 'ts-k-kvlist' })
    const preview = imageBlock({ title: 'Preview', alt: 'Thumbnail preview', maxHeight: 420 })
    const picker = el('div', { class: 'ts-k-chips' })
    const detail = el('div', { class: 'ts-k-kvlist' })
    const previewActions = el('div', { class: 'ts-k-actions' })

    let currentId = ''
    let selected = 'maxresdefault'
    /** Which sizes this video actually has. Unknown until an image decodes. */
    const available: Record<string, boolean> = {}

    function fail(message: string) {
      warning.textContent = message
      warning.hidden = false
    }

    /** Draw the image to a canvas and export a JPEG blob, so the file lands locally. */
    async function downloadThumbnail(thumbnail: Thumbnail, node: HTMLButtonElement) {
      const original = node.textContent
      node.disabled = true
      node.textContent = 'Fetching…'
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
        node.disabled = false
        node.textContent = original
      }
    }

    function renderPicker() {
      picker.replaceChildren(
        ...thumbnailsFor(currentId).map((thumbnail) => {
          const on = thumbnail.name === selected
          const missing = available[thumbnail.name] === false
          const node = button(thumbnail.label, {
            variant: on ? 'primary' : 'default',
            size: 'sm',
            title: missing ? 'This video has no thumbnail at this size' : thumbnail.note,
            disabled: missing,
            onClick: () => {
              selected = thumbnail.name
              renderPicker()
              renderPanel()
            },
          })
          node.append(el('span', { class: 'ts-k-hint' }, `${thumbnail.width}×${thumbnail.height}`))
          if (missing) node.classList.add('is-missing')
          return node
        }),
      )
    }

    function renderPanel() {
      const thumbnail = qualityByName(selected)
      if (!thumbnail) return
      const url = thumbnailsFor(currentId).find((item) => item.name === selected)!.url

      preview.image.src = url
      preview.image.referrerPolicy = 'no-referrer'
      preview.image.alt = `${thumbnail.label} thumbnail`
      preview.caption.textContent = ''

      const downloadButton = button('Download', { variant: 'primary', icon: 'download' })
      downloadButton.addEventListener('click', () => void downloadThumbnail({ ...thumbnail, url }, downloadButton))

      detail.replaceChildren(
        copyRow('Size', `${thumbnail.width}×${thumbnail.height} · ${thumbnail.aspect}`, { copy: false }),
        copyRow('URL', url),
      )
      previewActions.replaceChildren(downloadButton)

      preview.image.addEventListener('load', () => {
        const missing = isPlaceholder(preview.image.naturalWidth, preview.image.naturalHeight)
        available[thumbnail.name] = !missing
        if (missing) {
          preview.caption.textContent = 'Not available at this size'
          downloadButton.disabled = true
          downloadButton.title = 'This video has no thumbnail at this size'
          preview.root.classList.add('is-missing')
          // Move to the best size that does exist rather than sit on a blank one.
          const fallback = bestAvailable(available)
          if (fallback !== selected) {
            selected = fallback
            renderPicker()
            renderPanel()
            return
          }
        } else {
          preview.root.classList.remove('is-missing')
          downloadButton.disabled = false
          downloadButton.removeAttribute('title')
        }
        renderPicker()
      })
      preview.image.addEventListener('error', () => {
        available[thumbnail.name] = false
        preview.root.classList.add('is-missing')
        preview.caption.textContent = 'Not available at this size'
        downloadButton.disabled = true
        renderPicker()
      })
    }

    function renderLinks(id: string) {
      links.replaceChildren(
        copyRow('Video ID', id),
        copyRow('Watch link', watchUrl(id)),
        copyRow('Short link', shortUrl(id)),
      )
    }

    function update() {
      warning.hidden = true
      const id = parseVideoId(input.value)
      if (!id) {
        currentId = ''
        links.replaceChildren()
        picker.replaceChildren()
        preview.image.removeAttribute('src')
        preview.caption.textContent = ''
        detail.replaceChildren()
        if (input.value.trim() !== '') fail('That does not look like a YouTube link or video ID.')
        return
      }
      // A new video invalidates everything we knew about the old one's sizes.
      if (id !== currentId) {
        currentId = id
        for (const key of Object.keys(available)) delete available[key]
        selected = 'maxresdefault'
      }
      renderLinks(id)
      renderPicker()
      renderPanel()
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Link', icon: 'link' },
          input,
          chips([{ label: 'Clear', onClick: () => {
            input.value = ''
            update()
            input.focus()
          } }]),
          warning,
          links,
        ),
        panel({ title: 'Size', icon: 'layers' }, picker),
        preview.root,
        panel({ title: 'Details', icon: 'info' }, detail),
        note(
          'Pick a size, then copy its URL or download the image. Thumbnails are served from i.ytimg.com, so your browser fetches them directly from YouTube — toolspace never sees your link, and nothing is proxied. Downloading reads the image on a canvas and saves it locally; if the image cannot be read, the download falls back to the raw URL.',
        ),
      ),
    )

    preview.frame.after(previewActions)
    update()
  },
}

export default tool
