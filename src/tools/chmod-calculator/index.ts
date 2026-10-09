import {
  actions,
  badge,
  checkbox,
  copyRow,
  field,
  grid,
  kvList,
  note,
  outputBlock,
  panel,
  select,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import {
  ChmodError, explain, fromOctal, fromSymbolic, PRESETS, toOctal, toSymbolic,
  type Permissions, type Who,
} from './chmod'

const WHO_LABEL: Record<Who, string> = { owner: 'Owner', group: 'Group', other: 'Other' }
const VERBS = ['read', 'write', 'execute'] as const
const SPECIALS = ['setuid', 'setgid', 'sticky'] as const

const tool: Tool = {
  slug: 'chmod-calculator',
  name: 'Chmod Calculator',
  description: 'Build Unix file permissions and read them as octal, symbolic and chmod commands.',
  category: 'Code',
  keywords: ['chmod', 'permissions', 'unix', 'linux', 'octal', 'rwx', 'setuid', 'sticky'],
  render(root) {
    const permissions: Permissions = fromOctal('644')
    const octal = textField({ value: '0644', mono: true, onInput: () => applyOctal() })
    const symbolic = textField({ value: 'rw-r--r--', mono: true, onInput: () => applySymbolic() })
    const error = note('', 'danger')
    error.hidden = true
    const octalOut = badge('0644', 'accent')
    const symbolicOut = badge('rw-r--r--', 'accent')
    const explained = kvList()
    let commands = ''
    const commandBlock = outputBlock('', { label: 'Commands', copy: () => commands })

    const boxes = new Map<string, HTMLInputElement>()
    const rows = (['owner', 'group', 'other'] as Who[]).map((who) =>
      el(
        'div',
        { class: 'ts-k-actions' },
        el('span', { class: 'ts-k-label ts-chmod-who' }, WHO_LABEL[who]),
        ...VERBS.map((verb) => {
          const node = checkbox({
            label: verb,
            checked: permissions[who][verb],
            onChange: (checked) => {
              permissions[who][verb] = checked
              redraw()
            },
          })
          boxes.set(`${who}.${verb}`, node.querySelector('input') as HTMLInputElement)
          return node
        }),
      ),
    )

    const specialBoxes = SPECIALS.map((key) => {
      const node = checkbox({
        label: key,
        checked: permissions.special[key],
        onChange: (checked) => {
          permissions.special[key] = checked
          redraw()
        },
      })
      boxes.set(`special.${key}`, node.querySelector('input') as HTMLInputElement)
      return node
    })

    const preset = select({
      options: [{ value: '', label: 'Choose a preset…' }, ...PRESETS.map((item) => ({ value: item.octal, label: item.label }))],
      value: '',
      onChange: (value) => {
        if (!value) return
        Object.assign(permissions, fromOctal(value))
        preset.value = ''
        redraw()
      },
    })

    function syncBoxes() {
      for (const who of ['owner', 'group', 'other'] as Who[]) {
        for (const verb of VERBS) boxes.get(`${who}.${verb}`)!.checked = permissions[who][verb]
      }
      for (const key of SPECIALS) boxes.get(`special.${key}`)!.checked = permissions.special[key]
    }

    function redraw() {
      octal.value = toOctal(permissions).replace(/^0/, '')
      symbolic.value = toSymbolic(permissions)
      octalOut.textContent = toOctal(permissions)
      symbolicOut.textContent = toSymbolic(permissions)
      const detail = explain(permissions)
      explained.replaceChildren(
        copyRow('Owner', detail.owner),
        copyRow('Group', detail.group),
        copyRow('Other', detail.other),
        ...detail.special.map((line) => el('p', { class: 'ts-k-note ts-k-note--danger' }, line)),
      )
      commands = detail.commands
      commandBlock.body.replaceChildren(commands)
      commandBlock.setMeta('')
      error.hidden = true
      syncBoxes()
    }

    function applyOctal() {
      try {
        Object.assign(permissions, fromOctal(octal.value))
        redraw()
      } catch (err) {
        error.textContent = err instanceof ChmodError ? err.message : 'Enter 3 or 4 octal digits.'
        error.hidden = false
      }
    }

    function applySymbolic() {
      try {
        Object.assign(permissions, fromSymbolic(symbolic.value))
        redraw()
      } catch (err) {
        error.textContent = err instanceof ChmodError ? err.message : 'Enter 9 symbols like rwxr-xr-x.'
        error.hidden = false
      }
    }

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Permissions', icon: 'lock' },
          grid(200, field(octal, { label: 'Octal' }), field(symbolic, { label: 'Symbolic' }), field(preset, { label: 'Preset' })),
          el('div', { class: 'ts-chmod-grid' }, ...rows),
          actions(...specialBoxes),
          error,
        ),
        panel({ title: 'Result', icon: 'check' }, actions(octalOut, symbolicOut)),
        panel({ title: 'What it means', icon: 'info' }, explained),
        commandBlock,
              ),
    )

    redraw()
  },
}

export default tool
