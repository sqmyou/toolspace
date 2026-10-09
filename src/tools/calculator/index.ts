import {
  actions,
  button,
  checkbox,
  copyButton,
  field,
  note,
  panel,
  segmented,
  textField,
  toolLayout,
} from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import {
  ANGLE_UNITS,
  BITWISE_WIDTHS,
  CalcError,
  DEFAULT_PROGRAM_CONTEXT,
  evaluate,
  formatInMode,
  formatNumber,
  FUNCTION_NAMES,
  PROGRAMS,
  programById,
  type AngleMode,
  type BitwiseOp,
  type DmsMode,
  type NumberMode,
  type ProgramContext,
  type ProgramId,
} from './calc'

const KEYS: string[][] = [
  ['(', ')', '%', '^', 'clear'],
  ['7', '8', '9', '/', 'sqrt('],
  ['4', '5', '6', '*', '^2'],
  ['1', '2', '3', '-', 'pi'],
  ['0', '.', '!', '+', '='],
]

const LABELS: Record<string, string> = {
  clear: 'AC',
  'sqrt(': '√',
}

const HISTORY_KEY = 'toolspace:calculator:history'
const INPUT_ID = 'ts-calc-expression'

interface Entry {
  expression: string
  value: string
}

/** Read committed results back from localStorage; private mode just gets none. */
function readHistory(): Entry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry): entry is Entry => {
        if (!entry || typeof entry !== 'object') return false
        const candidate = entry as Record<string, unknown>
        return typeof candidate.expression === 'string' && typeof candidate.value === 'string'
      })
      .slice(0, 12)
  } catch {
    return []
  }
}

function writeHistory(entries: Entry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
  } catch {
    /* private mode: history still works for this session via the in-memory list */
  }
}

const tool: Tool = {
  slug: 'calculator',
  name: 'Calculator',
  description: 'Expression evaluation, unit conversion and bitwise work, with history.',
  category: 'Math',
  keywords: [
    'calculator', 'math', 'arithmetic', 'expression', 'evaluate', 'scientific',
    'sin', 'cos', 'log', 'angle', 'degrees', 'radians', 'bitwise', 'hex', 'binary',
    'dms',
  ],
  render(root) {
    const input = textField({
      value: '',
      mono: true,
      placeholder: 'e.g. 2 + 3 * 4, sqrt(2), sin(30) degrees…',
      onInput: () => compute(),
    })
    input.id = INPUT_ID
    input.setAttribute('aria-label', 'Expression')
    input.setAttribute('inputmode', 'text')
    input.autocomplete = 'off'
    input.spellcheck = false
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        commit()
      }
    })

    let degreesOn = false
    let numMode: NumberMode = 'dec'
    let currentValue: number | null = null
    let currentError = ''
    let lastValue = 0
    let entries: Entry[] = readHistory()

    const context: ProgramContext = { ...DEFAULT_PROGRAM_CONTEXT }
    let programId: ProgramId = 'angle'
    let programInputs: HTMLInputElement[] = []
    let programValue: number | null = null

    const result = el('div', { class: 'ts-calc-result ts-k-mono', 'aria-live': 'polite' }, '0')
    const detail = el('div', { class: 'ts-calc-detail' })
    const history = el('div', { class: 'ts-calc-history' })
    const pad = el('div', { class: 'ts-calc-pad' })
    const programBody = el('div', { class: 'ts-calc-program' })
    const programOut = el('div', { class: 'ts-calc-program-out ts-k-mono', 'aria-live': 'polite' })

    const programPick = segmented({
      items: PROGRAMS.map((program) => ({ value: program.id, label: program.label })),
      value: programId,
      label: 'Program',
      onChange: (value) => {
        programId = value as ProgramId
        renderProgram()
      },
    })

    function compute(): void {
      if (!input.value.trim()) {
        currentValue = null
        currentError = ''
        paint()
        return
      }
      try {
        currentValue = evaluate(input.value, { degrees: degreesOn, variables: { ans: lastValue } })
        currentError = ''
      } catch (error) {
        currentValue = null
        currentError = error instanceof CalcError || error instanceof Error ? error.message : 'Invalid expression.'
      }
      paint()
    }

    function paint(): void {
      if (currentValue !== null) {
        result.textContent = formatInMode(currentValue, numMode)
        result.classList.remove('is-error')
        detail.textContent = ''
      } else if (currentError) {
        result.textContent = '—'
        result.classList.add('is-error')
        detail.textContent = currentError
      } else {
        result.textContent = '0'
        result.classList.remove('is-error')
        detail.textContent = ''
      }
    }

    function commit(): void {
      compute()
      if (currentValue === null || !input.value.trim()) return
      const text = formatNumber(currentValue)
      lastValue = currentValue
      entries = [{ expression: input.value.trim(), value: text }, ...entries].slice(0, 12)
      writeHistory(entries)
      renderHistory()
    }

    function renderHistory(): void {
      history.replaceChildren(
        ...(entries.length
          ? entries.map((entry) =>
              el(
                'button',
                {
                  class: 'ts-calc-entry',
                  type: 'button',
                  title: 'Use this result',
                  onclick: () => {
                    input.value = entry.value
                    compute()
                    input.focus()
                  },
                },
                el('span', { class: 'ts-calc-entry-expr' }, entry.expression),
                el('span', { class: 'ts-calc-entry-val' }, `= ${entry.value}`),
              ),
            )
          : [el('p', { class: 'ts-k-hint ts-calc-empty' }, 'Press Enter or = to keep a result here. Click one to reuse it.')]),
      )
    }

    function insert(text: string): void {
      const start = input.selectionStart ?? input.value.length
      const end = input.selectionEnd ?? start
      input.value = input.value.slice(0, start) + text + input.value.slice(end)
      const caret = start + text.length
      input.setSelectionRange(caret, caret)
      input.focus()
      compute()
    }

    function clearAll(): void {
      input.value = ''
      compute()
      input.focus()
    }

    /* ---------------------------------------------------------------- keypad */

    for (const row of KEYS) {
      for (const key of row) {
        const isEquals = key === '='
        const keyButton = button(LABELS[key] ?? key, {
          variant: isEquals ? 'primary' : 'default',
          onClick: () => {
            if (key === 'clear') clearAll()
            else if (isEquals) commit()
            else insert(key)
          },
        })
        keyButton.classList.add('ts-calc-key')
        pad.append(keyButton)
      }
    }

    /* -------------------------------------------------------------- programs */

    function runProgram(): void {
      try {
        const values = programInputs.map((node) => (node.value.trim() ? evaluate(node.value, { degrees: degreesOn }) : 0))
        programValue = programById(programId).run(values, context)
        programOut.textContent = formatInMode(programValue, numMode)
        programOut.classList.remove('is-error')
      } catch {
        programValue = null
        programOut.textContent = 'Invalid'
        programOut.classList.add('is-error')
      }
    }

    function programSettings(): HTMLElement {
      const wrap = el('div', { class: 'ts-calc-settings' })
      if (programId === 'angle') {
        wrap.append(
          segmented({
            items: ANGLE_UNITS.map((unit) => ({ value: unit.value, label: unit.label })),
            value: context.angleMode,
            label: 'Angle unit',
            onChange: (value) => {
              context.angleMode = value as AngleMode
              renderProgram()
            },
          }),
        )
      } else if (programId === 'dms') {
        wrap.append(
          segmented({
            items: [
              { value: 'dd', label: 'D°' },
              { value: 'dm', label: 'D° M′' },
              { value: 'dms', label: 'D° M′ S″' },
            ],
            value: context.dmsMode,
            label: 'Fields',
            onChange: (value) => {
              context.dmsMode = value as DmsMode
              renderProgram()
            },
          }),
        )
      } else {
        wrap.append(
          segmented({
            items: [
              { value: 'and', label: 'AND' },
              { value: 'or', label: 'OR' },
              { value: 'xor', label: 'XOR' },
              { value: 'not', label: 'NOT' },
            ],
            value: context.bitwiseOp,
            label: 'Operation',
            onChange: (value) => {
              context.bitwiseOp = value as BitwiseOp
              renderProgram()
            },
          }),
          segmented({
            items: BITWISE_WIDTHS.map((width) => ({ value: String(width), label: `${width}-bit` })),
            value: String(context.notWidth),
            label: 'Width',
            onChange: (value) => {
              context.notWidth = Number(value)
              renderProgram()
            },
          }),
        )
      }
      return wrap
    }

    function renderProgram(): void {
      const program = programById(programId)
      const labels = program.fields(context)
      programInputs = labels.map((label) => {
        const node = textField({ value: '', mono: true, placeholder: '0', onInput: () => runProgram() })
        node.setAttribute('aria-label', label)
        node.setAttribute('inputmode', 'decimal')
        node.autocomplete = 'off'
        return node
      })

      const inputs = el('div', { class: 'ts-calc-program-inputs' })
      labels.forEach((label, index) => {
        const node = programInputs[index]
        node.classList.add('ts-calc-program-input')
        inputs.append(field(node, { label }))
      })

      programBody.replaceChildren(
        programPick,
        programSettings(),
        el('p', { class: 'ts-k-hint ts-calc-program-hint' }, program.hint),
        inputs,
        actions(
          button('Run', { variant: 'primary', icon: 'check', onClick: () => runProgram() }),
          button('Use result', {
            icon: 'refresh',
            onClick: () => {
              if (programValue === null) return
              input.value = formatNumber(programValue)
              compute()
              input.focus()
            },
          }),
        ),
        el('div', { class: 'ts-calc-program-readout' }, programOut),
      )
      runProgram()
    }

    /* ------------------------------------------------------------------ view */

    const historyHead = el(
      'div',
      { class: 'ts-calc-history-head' },
      button('Clear', {
        variant: 'ghost',
        size: 'sm',
        icon: 'close',
        onClick: () => {
          entries = []
          writeHistory(entries)
          renderHistory()
        },
      }),
    )

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Expression', icon: 'calculator' },
          field(input, { label: 'Expression', forId: INPUT_ID }),
          actions(
            checkbox({
              label: 'Trig in degrees',
              onChange: (checked) => {
                degreesOn = checked
                compute()
              },
            }),
            button('Calculate', { variant: 'primary', icon: 'check', onClick: commit }),
            button('Clear', { icon: 'close', onClick: clearAll }),
          ),
          el(
            'div',
            { class: 'ts-calc-readout' },
            el(
              'div',
              { class: 'ts-calc-readout-top' },
              result,
              copyButton(() => formatInMode(currentValue ?? 0, numMode), { label: 'Copy', size: 'sm' }),
            ),
            detail,
          ),
          el(
            'div',
            { class: 'ts-calc-modes' },
            segmented({
              items: [
                { value: 'dec', label: 'DEC' },
                { value: 'hex', label: 'HEX' },
                { value: 'bin', label: 'BIN' },
              ],
              value: numMode,
              label: 'Number format',
              onChange: (value) => {
                numMode = value as NumberMode
                paint()
                runProgram()
              },
            }),
          ),
        ),
        el(
          'div',
          { class: 'ts-k-split' },
          panel({ title: 'Keypad', icon: 'grid' }, pad),
          panel({ title: 'History', icon: 'clock', flush: true }, historyHead, history),
        ),
        panel({ title: 'Programs', icon: 'sliders' }, programBody),
        note(`Functions: ${FUNCTION_NAMES.join(', ')}. Constants: pi, tau, e, phi. Use "ans" to reuse the last committed result.`),
              ),
    )

    renderHistory()
    renderProgram()
    compute()
  },
}

export default tool
