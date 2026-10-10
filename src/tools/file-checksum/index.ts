import {
  actions,
  button,
  copyButton,
  copyRow,
  dropzone,
  field,
  kvList,
  note,
  panel,
  textarea,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import { download } from '../../core/ui'
import type { Tool } from '../../core/types'
import {
  checksumBytes,
  checksumText,
  digestFor,
  parseExpectedLine,
  verify,
  type ChecksumResult,
} from './checksum'

/** The digests shown, in the order they read on the page. */
const DIGESTS = ['CRC-32', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']

const EMPTY: ChecksumResult = { size: 0, crc32: '', sha1: '', sha256: '', sha384: '', sha512: '' }

/** A pause in typing before hashing, so a long paste is hashed once. */
const DEBOUNCE_MS = 180

/** Strip the parts of a filename that would make a messy download name. */
function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '-') || 'checksums'
}

const tool: Tool = {
  slug: 'file-checksum',
  name: 'File & Text Checksum',
  description: 'Compute CRC-32, SHA-1, SHA-256, SHA-384 and SHA-512 hashes of text or files.',
  category: 'Security',
  keywords: ['checksum', 'hash', 'sha256', 'sha1', 'sha512', 'crc32', 'digest', 'verify'],
  render(root) {
    const text = textarea({ rows: 4, placeholder: 'Type or paste text…', onInput: () => scheduleText() })
    text.id = 'ts-fc-text'

    const expected = textarea({
      rows: 2,
      placeholder: 'Paste a hash to check, e.g. ba7816bf…  file.txt',
      onInput: () => updateVerdict(),
    })
    expected.id = 'ts-fc-expected'

    const source = note('')
    source.hidden = true
    source.setAttribute('aria-live', 'polite')

    const verdict = note('')
    verdict.hidden = true
    verdict.setAttribute('aria-live', 'polite')

    const digests = kvList()
    digests.classList.add('ts-fc-digests')

    const empty = note('Type or paste text, or drop a file, to compute its digests.')

    let latest: ChecksumResult = EMPTY
    let latestLabel = ''
    let seq = 0
    let timer: number | undefined

    /** The whole checksum-file text, so copy and download hand over the same bytes. */
    function digestFile(): string {
      const width = Math.max(...DIGESTS.map((name) => name.length))
      return DIGESTS.map((name) => `${name.padEnd(width)}  ${digestFor(latest, name)}`).join('\n')
    }

    function row(name: string, value: string): HTMLElement {
      const node = copyRow(name, value)
      node.querySelector('button')?.setAttribute('aria-label', `Copy ${name} digest`)
      return node
    }

    function updateActions() {
      const has = latestLabel !== ''
      downloadButton.disabled = !has
      copyAll.disabled = !has
    }

    function updateVerdict() {
      const raw = expected.value.split('\n').find((line) => line.trim()) ?? ''
      if (!raw.trim() || latestLabel === '') {
        verdict.hidden = true
        return
      }
      const parsed = parseExpectedLine(raw)
      verdict.hidden = false
      if (!parsed) {
        verdict.className = 'ts-k-note ts-k-note--warn'
        verdict.textContent = 'That does not look like a hex digest this tool computes. Use 8, 40, 64, 96 or 128 hex characters.'
        return
      }
      const outcome = verify(parsed.hex, latest)
      const what = latestLabel === 'Text' ? 'text' : 'file'
      verdict.className = `ts-k-note ts-k-note--${outcome.status === 'match' ? 'ok' : 'danger'}`
      verdict.textContent = outcome.status === 'match'
        ? `Matches the ${parsed.algorithm} digest of the ${what}.`
        : `Does not match the ${parsed.algorithm} digest of the ${what}.`
    }

    function reset() {
      latest = EMPTY
      latestLabel = ''
      source.hidden = true
      empty.hidden = false
      digests.replaceChildren()
      updateVerdict()
      updateActions()
    }

    function renderResult(label: string, result: ChecksumResult) {
      latest = result
      latestLabel = label
      source.hidden = false
      source.textContent = `${label} · ${result.size.toLocaleString()} bytes`
      empty.hidden = true
      digests.replaceChildren(...DIGESTS.map((name) => row(name, digestFor(result, name))))
      updateVerdict()
      updateActions()
    }

    function fail(err: unknown) {
      latest = EMPTY
      latestLabel = ''
      empty.hidden = true
      digests.replaceChildren()
      source.hidden = false
      source.textContent = err instanceof Error ? err.message : 'This browser could not compute the digests.'
      updateVerdict()
      updateActions()
    }

    function scheduleText() {
      if (timer !== undefined) window.clearTimeout(timer)
      timer = window.setTimeout(() => void runText(), DEBOUNCE_MS)
    }

    async function runText() {
      const value = text.value
      const mine = ++seq
      if (!value) {
        reset()
        return
      }
      try {
        const result = await checksumText(value)
        if (mine !== seq) return
        renderResult('Text', result)
      } catch (err) {
        if (mine !== seq) return
        fail(err)
      }
    }

    const drop = dropzone({
      label: 'Drop a file to hash',
      hint: 'or choose one',
      icon: 'file',
      readAs: 'buffer',
      onFiles: () => {},
      onBuffers: async (buffers, files) => {
        const file = files[0]
        const mine = ++seq
        // A pending text hash must not overwrite this file's result.
        if (timer !== undefined) window.clearTimeout(timer)
        source.hidden = false
        source.textContent = `Hashing ${file.name}…`
        try {
          const result = await checksumBytes(new Uint8Array(buffers[0]))
          if (mine !== seq) return
          renderResult(file.name, result)
        } catch (err) {
          if (mine !== seq) return
          fail(err)
        }
      },
    })

    const copyAll = copyButton(() => digestFile(), { label: 'Copy all', size: 'sm' })
    copyAll.setAttribute('aria-label', 'Copy all digests')
    const downloadButton = button('Download', {
      icon: 'download',
      onClick: () => download(`${safeName(latestLabel)}.checksums.txt`, digestFile()),
    })

    const results = el('div', { class: 'ts-fc-live', 'aria-live': 'polite' }, empty, digests)

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Input', icon: 'file' },
          field(text, { label: 'Text', forId: text.id }),
          drop.root,
        ),
        panel(
          { title: 'Check a known hash', icon: 'shield' },
          field(expected, {
            label: 'Expected hash',
            forId: expected.id,
            hint: 'One line of sha256sum / shasum output, or a bare digest. The algorithm is read from its length.',
          }),
          verdict,
        ),
        panel(
          { title: 'Digests', icon: 'hash' },
          actions(source, copyAll, downloadButton),
          results,
        ),
        note('SHA digests come from your browser’s Web Crypto API; CRC-32 is computed locally. The file never leaves this tab.'),
      ),
    )

    reset()
    void runText()
  },
}

export default tool
