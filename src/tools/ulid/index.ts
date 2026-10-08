import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { decodeUlid, isUuid, ulid, uuidV4, uuidVersion } from './ulid'

const tool: Tool = {
  slug: 'ulid',
  name: 'ULID & UUID Generator',
  description: 'Generate sortable ULIDs and random UUID v4 values, and decode a ULID back to its timestamp.',
  category: 'Data',
  keywords: ['ulid', 'uuid', 'guid', 'id', 'identifier', 'sortable', 'random', 'unique'],
  render(root) {
    const count = el('input', { class: 'ts-input ts-mono', type: 'number', min: '1', max: '50', value: '5' }) as HTMLInputElement
    const ulidList = el('div', { class: 'ts-id-list' })
    const uuidList = el('div', { class: 'ts-id-list' })
    const decodeInput = el('input', { class: 'ts-input ts-mono', placeholder: 'Paste a ULID to decode', 'aria-label': 'ULID to decode' }) as HTMLInputElement
    const decodeOut = el('div', { class: 'ts-id-decode' })
    const uuidCheck = el('p', { class: 'ts-muted' })

    function generate() {
      const total = Math.max(1, Math.min(50, Number(count.value) || 1))
      ulidList.replaceChildren()
      uuidList.replaceChildren()
      for (let i = 0; i < total; i++) {
        const id = ulid()
        ulidList.append(el('div', { class: 'ts-id-row' }, el('code', {}, id), copyChip(id, 'Copy')))
      }
      for (let i = 0; i < total; i++) {
        const id = uuidV4()
        uuidList.append(el('div', { class: 'ts-id-row' }, el('code', {}, id), copyChip(id, 'Copy')))
      }
    }

    function decode() {
      decodeOut.replaceChildren()
      const value = decodeInput.value.trim()
      if (!value) {
        decodeOut.append(el('p', { class: 'ts-muted' }, 'Paste a ULID to see its embedded time.'))
        uuidCheck.textContent = ''
        return
      }
      try {
        const decoded = decodeUlid(value)
        decodeOut.append(
          el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, 'Created'), el('code', {}, decoded.time.toISOString()), copyChip(decoded.time.toISOString(), 'Copy')),
          el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, 'Epoch ms'), el('code', {}, String(decoded.timestamp)), copyChip(String(decoded.timestamp), 'Copy')),
          el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, 'Random part'), el('code', {}, decoded.random), copyChip(decoded.random, 'Copy')),
        )
        uuidCheck.textContent = ''
      } catch (err) {
        decodeOut.append(el('p', { class: 'ts-error' }, err instanceof Error ? err.message : 'Could not decode that ULID.'))
        uuidCheck.textContent = ''
      }
    }

    function checkUuid() {
      const value = decodeInput.value.trim()
      if (!value) return
      const version = uuidVersion(value)
      if (version !== null) {
        uuidCheck.textContent = `That looks like a UUID v${version}${isUuid(value) ? '' : ' (unusual variant)'}.`
      }
    }

    count.addEventListener('input', generate)
    decodeInput.addEventListener('input', () => {
      decode()
      checkUuid()
    })

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-row ts-between' }, el('div', { class: 'ts-inline-field' }, el('label', {}, 'How many'), count), el('button', { class: 'ts-button ts-primary', type: 'button', onclick: generate }, 'Generate')),
        el('h3', { class: 'ts-subhead' }, 'ULID (sortable by time)'),
        ulidList,
        el('h3', { class: 'ts-subhead' }, 'UUID v4 (random)'),
        uuidList,
        el('h3', { class: 'ts-subhead' }, 'Decode'),
        decodeInput,
        decodeOut,
        uuidCheck,
        el('p', { class: 'ts-note' }, 'ULIDs pack a millisecond timestamp into the first 10 characters, so sorting them as text sorts them by creation time. Randomness uses crypto.getRandomValues.'),
      ),
    )

    generate()
    decode()
  },
}

export default tool
