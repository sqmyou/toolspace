import { el } from '../../core/dom'
import { copyChip, download, readFileAsArrayBuffer } from '../../core/ui'
import type { Tool } from '../../core/types'
import { checksumBytes, checksumText, type ChecksumResult } from './checksum'

interface Entry {
  name: string
  value: string
}

const tool: Tool = {
  slug: 'file-checksum',
  name: 'File & Text Checksum',
  description: 'Compute CRC-32, SHA-1, SHA-256, SHA-384 and SHA-512 hashes of text or files.',
  category: 'Crypto',
  keywords: ['checksum', 'hash', 'sha256', 'sha1', 'sha512', 'crc32', 'digest', 'verify'],
  render(root) {
    const text = el('textarea', { class: 'ts-textarea', rows: 4, placeholder: 'Text to hash…', 'aria-label': 'Text' }) as HTMLTextAreaElement
    const expected = el('input', { class: 'ts-input ts-mono', placeholder: 'Paste a known hash to compare (optional)', 'aria-label': 'Expected hash' }) as HTMLInputElement
    const fileInput = el('input', { type: 'file' }) as HTMLInputElement
    const status = el('span', { class: 'ts-muted' })
    const rows = el('div', { class: 'ts-hash-list' })
    const verdict = el('p', { class: 'ts-verdict', hidden: true })

    let latest: Record<string, string> = {}

    function renderResults(label: string, size: number, entries: Entry[]) {
      latest = Object.fromEntries(entries.map((entry) => [entry.name, entry.value]))
      rows.replaceChildren(
        el('p', { class: 'ts-muted' }, `${label} · ${size.toLocaleString()} bytes`),
        ...entries.map((entry) =>
          el(
            'div',
            { class: 'ts-hash-row' },
            el('span', { class: 'ts-muted' }, entry.name),
            el('code', { class: 'ts-mono ts-value' }, entry.value),
            copyChip(() => entry.value),
          ),
        ),
      )
      updateVerdict()
    }

    const LENGTHS: Record<number, string> = { 8: 'CRC-32', 40: 'SHA-1', 64: 'SHA-256', 96: 'SHA-384', 128: 'SHA-512' }

    function updateVerdict() {
      const want = expected.value.trim().toLowerCase()
      if (!want) {
        verdict.hidden = true
        return
      }
      const name = LENGTHS[want.length]
      const actual = name ? latest[name]?.toLowerCase() : undefined
      const match = actual === want
      verdict.hidden = false
      verdict.className = `ts-verdict ${match ? 'ts-verdict-ok' : 'ts-verdict-bad'}`
      verdict.textContent = match ? `✓ Matches the expected ${name}` : '✗ Does not match the expected hash'
    }

    async function hashText() {
      const result = await checksumText(text.value)
      renderResults('Text', result.size, entriesOf(result))
    }

    function entriesOf(result: ChecksumResult): Entry[] {
      return [
        { name: 'CRC-32', value: result.crc32 },
        { name: 'SHA-1', value: result.sha1 },
        { name: 'SHA-256', value: result.sha256 },
        { name: 'SHA-384', value: result.sha384 },
        { name: 'SHA-512', value: result.sha512 },
      ]
    }

    text.addEventListener('input', () => void hashText())
    expected.addEventListener('input', updateVerdict)

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0]
      if (!file) return
      status.textContent = `Hashing ${file.name}…`
      const buffer = await readFileAsArrayBuffer(file)
      const result = await checksumBytes(new Uint8Array(buffer))
      renderResults(file.name, result.size, entriesOf(result))
      status.textContent = ''
    })

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Text'), text),
        el('div', { class: 'ts-field' }, el('label', {}, 'Verify against a hash'), expected),
        verdict,
        el('h3', { class: 'ts-subhead' }, 'Hash a file'),
        el('div', { class: 'ts-row ts-wrap' }, fileInput, status),
        el('h3', { class: 'ts-subhead' }, 'Digests'),
        rows,
        el('div', { class: 'ts-row ts-wrap' }, el('button', {
          class: 'ts-button',
          type: 'button',
          onclick: () => download('sha256.txt', latest['SHA-256'] ?? ''),
        }, 'Download SHA-256')),
        el('p', { class: 'ts-note' }, 'Hashing happens in your browser. Files are read locally and never uploaded.'),
      ),
    )

    void hashText()
  },
}

export default tool
