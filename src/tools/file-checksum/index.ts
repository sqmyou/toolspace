import {
  actions,
  button,
  copyRow,
  dropzone,
  field,
  kvList,
  note,
  panel,
  textarea,
  textField,
  toolLayout,
} from '../../core/components'
import { download } from '../../core/ui'
import type { Tool } from '../../core/types'
import { checksumBytes, checksumText, type ChecksumResult } from './checksum'

const LENGTHS: Record<number, string> = { 8: 'CRC-32', 40: 'SHA-1', 64: 'SHA-256', 96: 'SHA-384', 128: 'SHA-512' }

const tool: Tool = {
  slug: 'file-checksum',
  name: 'File & Text Checksum',
  description: 'Compute CRC-32, SHA-1, SHA-256, SHA-384 and SHA-512 hashes of text or files.',
  category: 'Crypto',
  keywords: ['checksum', 'hash', 'sha256', 'sha1', 'sha512', 'crc32', 'digest', 'verify'],
  render(root) {
    const text = textarea({ rows: 4, placeholder: 'Text to hash…', onInput: () => void hashText() })
    const expected = textField({ placeholder: 'Paste a known hash to compare (optional)', mono: true, onInput: () => updateVerdict() })
    const verdict = note('')
    verdict.hidden = true
    const source = note('')
    const digests = kvList()
    let latest: Record<string, string> = {}

    function entriesOf(result: ChecksumResult): [string, string][] {
      return [
        ['CRC-32', result.crc32],
        ['SHA-1', result.sha1],
        ['SHA-256', result.sha256],
        ['SHA-384', result.sha384],
        ['SHA-512', result.sha512],
      ]
    }

    function renderResults(label: string, size: number, entries: [string, string][]) {
      latest = Object.fromEntries(entries)
      source.textContent = `${label} · ${size.toLocaleString()} bytes`
      digests.replaceChildren(...entries.map(([name, value]) => copyRow(name, value)))
      updateVerdict()
    }

    function updateVerdict() {
      const want = expected.value.trim().toLowerCase()
      if (!want) {
        verdict.hidden = true
        return
      }
      const name = LENGTHS[want.length]
      const match = name ? latest[name]?.toLowerCase() === want : false
      verdict.hidden = false
      verdict.className = `ts-k-note ts-k-note--${match ? 'ok' : 'danger'}`
      verdict.textContent = match ? `Matches the expected ${name}` : 'Does not match the expected hash'
    }

    async function hashText() {
      const result = await checksumText(text.value)
      renderResults('Text', result.size, entriesOf(result))
    }

    const drop = dropzone({
      label: 'Drop a file to hash',
      hint: 'or choose one',
      icon: 'file',
      readAs: 'buffer',
      onFiles: () => {},
      onBuffers: async (buffers, files) => {
        source.textContent = `Hashing ${files[0].name}…`
        const result = await checksumBytes(new Uint8Array(buffers[0]))
        renderResults(files[0].name, result.size, entriesOf(result))
      },
    })

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Input', icon: 'file' },
          field(text, { label: 'Text' }),
          field(expected, { label: 'Verify against a hash' }),
          verdict,
        ),
        drop.root,
        panel(
          { title: 'Digests', icon: 'hash' },
          actions(source, button('Download SHA-256', { icon: 'download', onClick: () => download('sha256.txt', latest['SHA-256'] ?? '') })),
          digests,
        ),
              ),
    )

    void hashText()
  },
}

export default tool
