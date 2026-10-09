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
  appUrl,
  ASSETS,
  assetByName,
  artworkFilename,
  imageUrl,
  parseAppId,
  type SteamAsset,
} from './steam'

const SAMPLE = 'https://store.steampowered.com/app/570/Dota_2/'

const tool: Tool = {
  slug: 'steam-artwork',
  name: 'Steam Artwork',
  description: 'Paste a Steam app id or store link to preview and grab its header, capsule, library and hero art.',
  category: 'Media',
  keywords: ['steam', 'artwork', 'cover', 'capsule', 'header', 'hero', 'game', 'valve', 'store', 'image'],
  remote: {
    host: 'cdn.cloudflare.steamstatic.com',
    note: 'It asks Steam\u2019s image CDN for the public artwork of the app you named. Nothing you type is sent anywhere else, there is no API key, and no cookies are involved.',
  },
  render(root) {
    const input = textField({
      value: SAMPLE,
      placeholder: 'Paste a Steam link or app id\u2026',
      onInput: () => update(),
    })
    input.spellcheck = false
    input.setAttribute('aria-label', 'Steam app id or store link')

    const warning = note('', 'danger')
    warning.hidden = true
    const links = el('div', { class: 'ts-k-kvlist' })
    const preview = imageBlock({ title: 'Preview', alt: 'Steam artwork preview', maxHeight: 460 })
    const picker = el('div', { class: 'ts-k-chips' })
    const detail = el('div', { class: 'ts-k-kvlist' })
    const previewActions = el('div', { class: 'ts-k-actions' })

    let currentId = ''
    let selected = ASSETS[0].name
    /** Which artwork files this app actually has. Unknown until an image decodes. */
    const available: Record<string, boolean> = {}

    function fail(message: string) {
      warning.textContent = message
      warning.hidden = false
    }

    /** Draw the image to a canvas and export a JPEG blob, so the file lands locally. */
    async function downloadArtwork(asset: SteamAsset, url: string, node: HTMLButtonElement) {
      const original = node.textContent
      node.disabled = true
      node.textContent = 'Fetching\u2026'
      try {
        const response = await fetch(url, { mode: 'cors', cache: 'force-cache' })
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
        const objectUrl = URL.createObjectURL(jpeg)
        const link = el('a', {
          href: objectUrl,
          download: artworkFilename(currentId, asset.name),
        }) as HTMLAnchorElement
        document.body.append(link)
        link.click()
        link.remove()
        // Revoke on the next tick so the download has started.
        setTimeout(() => URL.revokeObjectURL(objectUrl), 4000)
      } catch {
        // The bytes could not be re-read, but the browser can still save the URL.
        const link = el('a', {
          href: url,
          download: artworkFilename(currentId, asset.name),
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
        ...ASSETS.map((asset) => {
          const on = asset.name === selected
          const missing = available[asset.name] === false
          const node = button(asset.label, {
            variant: on ? 'primary' : 'default',
            size: 'sm',
            title: missing ? 'This app has no artwork at this size' : asset.note,
            disabled: missing,
            onClick: () => {
              selected = asset.name
              renderPicker()
              renderPanel()
            },
          })
          node.append(el('span', { class: 'ts-k-hint' }, `${asset.width}\u00d7${asset.height}`))
          if (missing) node.classList.add('is-missing')
          return node
        }),
      )
    }

    function renderPanel() {
      const asset = assetByName(selected)
      if (!asset) return
      const url = imageUrl(currentId, asset.name)

      preview.image.src = url
      preview.image.referrerPolicy = 'no-referrer'
      preview.image.alt = `${asset.label} artwork`
      preview.caption.textContent = ''

      const downloadButton = button('Download', { variant: 'primary', icon: 'download' })
      downloadButton.addEventListener('click', () => void downloadArtwork(asset, url, downloadButton))

      detail.replaceChildren(
        copyRow('Size', `${asset.width}\u00d7${asset.height}`),
        copyRow('URL', url),
      )
      previewActions.replaceChildren(downloadButton)

      preview.image.addEventListener('load', () => {
        available[asset.name] = true
        preview.root.classList.remove('is-missing')
        downloadButton.disabled = false
        downloadButton.removeAttribute('title')
        renderPicker()
      })
      preview.image.addEventListener('error', () => {
        available[asset.name] = false
        preview.root.classList.add('is-missing')
        preview.caption.textContent = 'This app has no artwork at this size'
        downloadButton.disabled = true
        renderPicker()
      })
    }

    function renderLinks(id: string) {
      links.replaceChildren(
        copyRow('App ID', id),
        copyRow('Store page', appUrl(id)),
      )
    }

    /** Probe every artwork file so missing ones are disabled up front. */
    function probeAll(id: string) {
      for (const asset of ASSETS) {
        const probe = new Image()
        probe.referrerPolicy = 'no-referrer'
        probe.onload = () => {
          if (id !== currentId) return
          available[asset.name] = true
          renderPicker()
        }
        probe.onerror = () => {
          if (id !== currentId) return
          available[asset.name] = false
          renderPicker()
        }
        probe.src = imageUrl(id, asset.name)
      }
    }

    function update() {
      warning.hidden = true
      const id = parseAppId(input.value)
      if (!id) {
        currentId = ''
        links.replaceChildren()
        picker.replaceChildren()
        preview.image.removeAttribute('src')
        preview.caption.textContent = ''
        detail.replaceChildren()
        if (input.value.trim() !== '') fail('That does not look like a Steam link or app id.')
        return
      }
      if (id !== currentId) {
        currentId = id
        for (const key of Object.keys(available)) delete available[key]
        selected = ASSETS[0].name
        probeAll(id)
      }
      renderLinks(id)
      renderPicker()
      renderPanel()
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'App', icon: 'link' },
          input,
          chips([{ label: 'Clear', onClick: () => {
            input.value = ''
            update()
            input.focus()
          } }]),
          warning,
          links,
        ),
        panel({ title: 'Artwork', icon: 'layers' }, picker),
        preview.root,
        panel({ title: 'Details', icon: 'info' }, detail),
        note(
          'Pick a size, then copy its URL or download the image. Steam serves this artwork from cdn.cloudflare.steamstatic.com, so your browser fetches it directly from Steam \u2014 toolspace never sees your app id, and nothing is proxied. Downloading reads the image on a canvas and saves it locally; if the image cannot be read, the download falls back to the raw URL.',
        ),
      ),
    )

    preview.frame.after(previewActions)
    update()
  },
}

export default tool
