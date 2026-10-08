import {
  actions,
  button,
  copyRow,
  kvList,
  note,
  panel,
  section,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { decodeUlid, isUuid, ulid, uuidV4, uuidVersion } from './ulid'

const tool: Tool = {
  slug: 'ulid',
  name: 'ULID & UUID Generator',
  description: 'Generate sortable ULIDs and random UUID v4 values, and decode a ULID back to its timestamp.',
  category: 'Data',
  keywords: ['ulid', 'uuid', 'guid', 'id', 'identifier', 'sortable', 'random', 'unique'],
  render(root) {
    const count = textField({ type: 'number', value: '5', mono: true, onInput: () => generate() })
    const ulidList = el('div', { class: 'ts-id-list' })
    const uuidList = el('div', { class: 'ts-id-list' })
    const decodeInput = textField({
      mono: true,
      placeholder: 'Paste a ULID or UUID…',
      onInput: () => {
        decode()
        checkUuid()
      },
    })
    const decodeRows = kvList()
    const decodeNote = note('Paste a ULID to see its embedded time.')
    const uuidCheck = el('p', { class: 'ts-k-hint' })

    function idRow(id: string) {
      return el(
        'div',
        { class: 'ts-id-row' },
        el('code', {}, id),
        button('Copy', { variant: 'ghost', size: 'sm', icon: 'copy', onClick: () => void navigator.clipboard.writeText(id) }),
      )
    }

    function generate() {
      const total = Math.max(1, Math.min(50, Number(count.value) || 1))
      ulidList.replaceChildren(...Array.from({ length: total }, () => idRow(ulid())))
      uuidList.replaceChildren(...Array.from({ length: total }, () => idRow(uuidV4())))
    }

    function decode() {
      decodeRows.replaceChildren()
      const value = decodeInput.value.trim()
      if (!value) {
        decodeRows.append(decodeNote)
        return
      }
      try {
        const decoded = decodeUlid(value)
        decodeRows.replaceChildren(
          copyRow('Created', decoded.time.toISOString()),
          copyRow('Epoch ms', String(decoded.timestamp)),
          copyRow('Random part', decoded.random),
        )
      } catch (err) {
        decodeRows.replaceChildren(note(err instanceof Error ? err.message : 'Could not decode that ULID.', 'danger'))
      }
    }

    function checkUuid() {
      const value = decodeInput.value.trim()
      const version = value ? uuidVersion(value) : null
      uuidCheck.textContent = version !== null
        ? `That looks like a UUID v${version}${isUuid(value) ? '' : ' (unusual variant)'}.`
        : ''
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Generate', icon: 'hash' },
          actions(count, button('Generate', { variant: 'primary', icon: 'refresh', onClick: generate })),
          section('ULID — sortable by time', ulidList),
          section('UUID v4 — random', uuidList),
        ),
        panel({ title: 'Decode', icon: 'search' }, decodeInput, decodeRows, uuidCheck),
        note('ULIDs pack a millisecond timestamp into the first 10 characters, so sorting them as text sorts them by creation time. Randomness uses crypto.getRandomValues.'),
      ),
    )

    generate()
    decode()
  },
}

export default tool
