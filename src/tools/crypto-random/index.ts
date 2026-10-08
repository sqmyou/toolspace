import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import { randomBetween, randomHex, randomPassword, randomToken, type CharSetName } from './random'

const SET_LABELS: [CharSetName, string][] = [
  ['lower', 'a-z'],
  ['upper', 'A-Z'],
  ['digits', '0-9'],
  ['symbols', 'Symbols'],
]

const tool: Tool = {
  slug: 'crypto-random',
  name: 'Random Generator',
  description: 'Cryptographically random numbers, bytes, hex, tokens and passwords.',
  category: 'Security',
  keywords: ['random', 'crypto', 'password', 'token', 'hex', 'bytes', 'secure', 'entropy', 'nonce'],
  render(root) {
    const kind = el(
      'select',
      { class: 'ts-select' },
      el('option', { value: 'number' }, 'Number in a range'),
      el('option', { value: 'bytes' }, 'Random bytes (hex)'),
      el('option', { value: 'token' }, 'URL-safe token'),
      el('option', { value: 'password' }, 'Password'),
    ) as HTMLSelectElement
    const min = el('input', { class: 'ts-input ts-mono', type: 'number', value: '1' }) as HTMLInputElement
    const max = el('input', { class: 'ts-input ts-mono', type: 'number', value: '100' }) as HTMLInputElement
    const length = el('input', { class: 'ts-input ts-mono', type: 'number', min: '1', max: '256', value: '16' }) as HTMLInputElement
    const count = el('input', { class: 'ts-input ts-mono', type: 'number', min: '1', max: '20', value: '5' }) as HTMLInputElement
    const requireEach = el('input', { type: 'checkbox', checked: true }) as HTMLInputElement
    const setBoxes = SET_LABELS.map(([name, label]) => ({ name, box: el('input', { type: 'checkbox', checked: true }) as HTMLInputElement, label }))
    const error = el('p', { class: 'ts-error', hidden: true })
    const list = el('div', { class: 'ts-copy-list' })
    let values: string[] = []

    function controlGroup() {
      const show = (node: HTMLElement, visible: boolean) => node.toggleAttribute('hidden', !visible)
      show(min.closest('.ts-inline-field') as HTMLElement, kind.value === 'number')
      show(max.closest('.ts-inline-field') as HTMLElement, kind.value === 'number')
      show(length.closest('.ts-inline-field') as HTMLElement, kind.value !== 'number')
      show(setsBox, kind.value === 'password')
      show(requireEach.closest('.ts-inline-field') as HTMLElement, kind.value === 'password')
    }

    const setsBox = el('div', { class: 'ts-row ts-wrap' }, ...setBoxes.map(({ box, label }) => el('label', { class: 'ts-inline-field' }, box, label)))

    function generate() {
      list.replaceChildren()
      try {
        const total = Math.max(1, Math.min(20, Number(count.value) || 1))
        values = []
        for (let i = 0; i < total; i++) {
          if (kind.value === 'number') values.push(String(randomBetween(Number(min.value) || 0, Number(max.value) || 0)))
          else if (kind.value === 'bytes') values.push(randomHex(Number(length.value) || 16))
          else if (kind.value === 'token') values.push(randomToken(Number(length.value) || 16))
          else {
            const sets = setBoxes.filter(({ box }) => box.checked).map(({ name }) => name)
            values.push(randomPassword({ length: Number(length.value) || 16, sets, requireEach: requireEach.checked }))
          }
        }
        for (const value of values) list.append(el('div', { class: 'ts-copy-row' }, el('code', { class: 'ts-random-value' }, value), copyChip(value, 'Copy')))
        error.hidden = true
      } catch (err) {
        values = []
        error.textContent = err instanceof Error ? err.message : 'Could not generate that.'
        error.hidden = false
      }
    }

    kind.addEventListener('change', () => {
      controlGroup()
      generate()
    })
    for (const input of [min, max, length, count, requireEach, ...setBoxes.map(({ box }) => box)]) input.addEventListener('change', generate)

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Type'), kind),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Min'), min),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Max'), max),
          el('div', { class: 'ts-inline-field' }, el('label', {}, kind.value === 'password' ? 'Length' : 'Length / bytes'), length),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'How many'), count),
        ),
        setsBox,
        el('label', { class: 'ts-inline-field' }, requireEach, 'Require one of each selected set'),
        error,
        el('div', { class: 'ts-row ts-between' }, el('span', { class: 'ts-muted' }, 'Results'), el('button', { class: 'ts-button ts-primary', type: 'button', onclick: generate }, 'Generate')),
        list,
        copyChip(() => values.join('\n'), 'Copy all'),
        el('p', { class: 'ts-note' }, 'Values come from crypto.getRandomValues with rejection sampling, so every result in the range is equally likely. Nothing is sent anywhere.'),
      ),
    )

    controlGroup()
    generate()
  },
}

export default tool
