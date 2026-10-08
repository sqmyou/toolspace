import { el } from '../../core/dom'
import { copyChip } from '../../core/ui'
import type { Tool } from '../../core/types'
import {
  ChmodError, explain, fromOctal, fromSymbolic, PRESETS, toOctal, toSymbolic,
  type Permission, type Permissions, type Who,
} from './chmod'

const WHO_LABEL: Record<Who, string> = { owner: 'Owner', group: 'Group', other: 'Other' }
const VERBS = ['read', 'write', 'execute'] as const

const tool: Tool = {
  slug: 'chmod-calculator',
  name: 'Chmod Calculator',
  description: 'Build Unix file permissions and read them as octal, symbolic and chmod commands.',
  category: 'Code',
  keywords: ['chmod', 'permissions', 'unix', 'linux', 'octal', 'rwx', 'setuid', 'sticky'],
  render(root) {
    const permissions: Permissions = fromOctal('644')
    const octalInput = el('input', { class: 'ts-input ts-mono', type: 'text', value: '0644', spellcheck: false, 'aria-label': 'Octal' }) as HTMLInputElement
    const symbolicInput = el('input', { class: 'ts-input ts-mono', type: 'text', value: 'rw-r--r--', spellcheck: false, 'aria-label': 'Symbolic' }) as HTMLInputElement
    const error = el('p', { class: 'ts-error', hidden: true })
    const output = el('div', { class: 'ts-copy-list' })
    const explanation = el('div', { class: 'ts-chmod-explained' })
    const presetSelect = el('select', { class: 'ts-select' }) as HTMLSelectElement
    presetSelect.append(el('option', { value: '' }, 'Choose a preset…'))
    for (const preset of PRESETS) presetSelect.append(el('option', { value: preset.octal }, preset.label))

    const boxes = new Map<string, HTMLInputElement>()
    for (const who of ['owner', 'group', 'other'] as Who[]) {
      for (const verb of VERBS) {
        const box = el('input', { type: 'checkbox' }) as HTMLInputElement
        boxes.set(`${who}.${verb}`, box)
      }
    }
    const specialBoxes = {
      setuid: el('input', { type: 'checkbox' }) as HTMLInputElement,
      setgid: el('input', { type: 'checkbox' }) as HTMLInputElement,
      sticky: el('input', { type: 'checkbox' }) as HTMLInputElement,
    }

    const octalDisplay = el('code', { class: 'ts-chmod-big' })
    const symbolicDisplay = el('code', { class: 'ts-chmod-big' })

    function syncInputs() {
      const octal = toOctal(permissions).replace(/^0/, '')
      octalInput.value = octal
      symbolicInput.value = toSymbolic(permissions)
      octalDisplay.textContent = toOctal(permissions)
      symbolicDisplay.textContent = toSymbolic(permissions)
      for (const who of ['owner', 'group', 'other'] as Who[]) {
        for (const verb of VERBS) boxes.get(`${who}.${verb}`)!.checked = permissions[who][verb]
      }
      specialBoxes.setuid.checked = permissions.special.setuid
      specialBoxes.setgid.checked = permissions.special.setgid
      specialBoxes.sticky.checked = permissions.special.sticky
    }

    function renderExplanation() {
      const detail = explain(permissions)
      explanation.replaceChildren(
        el('p', {}, el('strong', {}, 'Owner: '), detail.owner),
        el('p', {}, el('strong', {}, 'Group: '), detail.group),
        el('p', {}, el('strong', {}, 'Other: '), detail.other),
        ...detail.special.map((line) => el('p', { class: 'ts-warn-text' }, line)),
      )
      output.replaceChildren(
        el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, `chmod ${detail.commands.split('\n')[0].replace('chmod ', '')}`), copyChip(detail.commands.split('\n')[0])),
        el('div', { class: 'ts-copy-row' }, el('span', { class: 'ts-muted' }, 'symbolic'), copyChip(detail.commands.split('\n')[1])),
      )
    }

    function redraw() {
      syncInputs()
      renderExplanation()
      error.hidden = true
    }

    function onToggle(who: Who, verb: keyof Permission, checked: boolean) {
      permissions[who][verb] = checked
      redraw()
    }

    for (const who of ['owner', 'group', 'other'] as Who[]) {
      for (const verb of VERBS) {
        boxes.get(`${who}.${verb}`)!.addEventListener('change', (event) => onToggle(who, verb, (event.target as HTMLInputElement).checked))
      }
    }
    specialBoxes.setuid.addEventListener('change', () => { permissions.special.setuid = specialBoxes.setuid.checked; redraw() })
    specialBoxes.setgid.addEventListener('change', () => { permissions.special.setgid = specialBoxes.setgid.checked; redraw() })
    specialBoxes.sticky.addEventListener('change', () => { permissions.special.sticky = specialBoxes.sticky.checked; redraw() })

    octalInput.addEventListener('input', () => {
      try {
        Object.assign(permissions, fromOctal(octalInput.value))
        redraw()
      } catch (err) {
        error.textContent = err instanceof ChmodError ? err.message : 'Enter 3 or 4 octal digits.'
        error.hidden = false
      }
    })

    symbolicInput.addEventListener('input', () => {
      try {
        Object.assign(permissions, fromSymbolic(symbolicInput.value))
        redraw()
      } catch (err) {
        error.textContent = err instanceof ChmodError ? err.message : 'Enter 9 symbols like rwxr-xr-x.'
        error.hidden = false
      }
    })

    presetSelect.addEventListener('change', () => {
      if (!presetSelect.value) return
      Object.assign(permissions, fromOctal(presetSelect.value))
      presetSelect.value = ''
      redraw()
    })

    function permissionRow(who: Who) {
      return el(
        'div',
        { class: 'ts-chmod-row' },
        el('span', { class: 'ts-chmod-who' }, WHO_LABEL[who]),
        ...VERBS.map((verb) => el('label', { class: 'ts-inline-field' }, boxes.get(`${who}.${verb}`)!, verb)),
      )
    }

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el(
          'div',
          { class: 'ts-row ts-wrap ts-between' },
          el(
            'div',
            { class: 'ts-row ts-wrap' },
            el('div', { class: 'ts-inline-field' }, el('label', {}, 'Octal'), octalInput),
            el('div', { class: 'ts-inline-field' }, el('label', {}, 'Symbolic'), symbolicInput),
          ),
          el('div', { class: 'ts-inline-field' }, el('label', {}, 'Preset'), presetSelect),
        ),
        error,
        el('div', { class: 'ts-chmod-grid' }, permissionRow('owner'), permissionRow('group'), permissionRow('other')),
        el(
          'div',
          { class: 'ts-row ts-wrap' },
          el('label', { class: 'ts-inline-field' }, specialBoxes.setuid, 'setuid'),
          el('label', { class: 'ts-inline-field' }, specialBoxes.setgid, 'setgid'),
          el('label', { class: 'ts-inline-field' }, specialBoxes.sticky, 'sticky'),
        ),
        el('div', { class: 'ts-chmod-result' }, el('span', { class: 'ts-muted' }, 'Octal'), octalDisplay, el('span', { class: 'ts-muted' }, 'Symbolic'), symbolicDisplay),
        explanation,
        el('h3', { class: 'ts-subhead' }, 'Commands'),
        output,
        el('p', { class: 'ts-note' }, 'Everything is computed locally — no file is ever touched.'),
      ),
    )

    redraw()
  },
}

export default tool
