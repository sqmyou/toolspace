import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { CalcError, evaluate, formatNumber, FUNCTION_NAMES } from './calc'

const KEYS: string[][] = [
  ['(', ')', '%', '^', 'clear'],
  ['7', '8', '9', '/', 'sqrt('],
  ['4', '5', '6', '*', '^2'],
  ['1', '2', '3', '-', 'pi'],
  ['0', '.', '!', '+', '='],
]

const LABELS: Record<string, string> = {
  clear: 'AC',
  '=': '=',
  sqrt: '√',
  'sqrt(': '√',
}

const tool: Tool = {
  slug: 'calculator',
  name: 'Calculator',
  description: 'Evaluate arithmetic expressions with functions, constants and history.',
  category: 'Math',
  keywords: ['calculator', 'math', 'arithmetic', 'expression', 'evaluate', 'scientific', 'sin', 'cos', 'log'],
  render(root) {
    const input = el('input', {
      class: 'ts-input ts-mono ts-calc-input',
      type: 'text',
      inputmode: 'text',
      spellcheck: false,
      autocomplete: 'off',
      placeholder: 'e.g. 2 + 3 * 4, sqrt(2), sin(30) degrees…',
      'aria-label': 'Expression',
    }) as HTMLInputElement

    const degrees = el('input', { type: 'checkbox', id: 'ts-calc-degrees' }) as HTMLInputElement
    const result = el('div', { class: 'ts-calc-result', 'aria-live': 'polite' }, '0')
    const detail = el('div', { class: 'ts-calc-detail' })
    const history = el('div', { class: 'ts-calc-history' })
    const pad = el('div', { class: 'ts-calc-pad' })

    let entries: { expression: string; value: string }[] = []
    let lastValue = 0

    function compute() {
      try {
        const value = evaluate(input.value, { degrees: degrees.checked, variables: { ans: lastValue } })
        const text = formatNumber(value)
        result.textContent = text
        result.classList.remove('is-error')
        detail.textContent = ''
        return text
      } catch (error) {
        if (!input.value.trim()) {
          result.textContent = '0'
          result.classList.remove('is-error')
          detail.textContent = ''
          return null
        }
        result.textContent = '—'
        result.classList.add('is-error')
        detail.textContent = error instanceof CalcError || error instanceof Error ? error.message : 'Invalid expression.'
        return null
      }
    }

    function commit() {
      const text = compute()
      if (text === null || !input.value.trim()) return
      lastValue = Number(text)
      entries = [{ expression: input.value.trim(), value: text }, ...entries].slice(0, 12)
      renderHistory()
    }

    function renderHistory() {
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
          : [el('p', { class: 'ts-muted ts-calc-empty' }, 'Results you commit are listed here. Click one to reuse it.')]),
      )
    }

    function insert(text: string) {
      const start = input.selectionStart ?? input.value.length
      const end = input.selectionEnd ?? start
      input.value = input.value.slice(0, start) + text + input.value.slice(end)
      const caret = start + text.length
      input.setSelectionRange(caret, caret)
      input.focus()
      compute()
    }

    for (const row of KEYS) {
      for (const key of row) {
        const isEquals = key === '='
        const button = el(
          'button',
          { class: `ts-calc-key${isEquals ? ' ts-calc-key-eq' : ''}`, type: 'button' },
          LABELS[key] ?? key,
        )
        button.addEventListener('click', () => {
          if (key === 'clear') {
            input.value = ''
            compute()
            input.focus()
          } else if (isEquals) {
            commit()
          } else {
            insert(key)
          }
        })
        pad.append(button)
      }
    }

    input.addEventListener('input', compute)
    degrees.addEventListener('change', compute)
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        commit()
      }
    })

    root.append(
      el(
        'div',
        { class: 'ts-tool ts-tool-wide' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Expression'), input),
        el(
          'div',
          { class: 'ts-calc-controls' },
          el('label', { class: 'ts-check', for: 'ts-calc-degrees' }, degrees, ' Trig in degrees'),
          el('button', { class: 'ts-button', type: 'button', onclick: commit }, 'Calculate'),
        ),
        result,
        detail,
        el('div', { class: 'ts-calc-columns' }, pad, el('div', { class: 'ts-json-block' }, el('div', { class: 'ts-json-head' }, el('span', {}, 'History')), history)),
        el('p', { class: 'ts-note' }, `Functions: ${FUNCTION_NAMES.join(', ')}. Constants: pi, tau, e, phi. Use "ans" to reuse the last committed result.`),
        el('p', { class: 'ts-note' }, 'Everything is evaluated in your browser.'),
      ),
    )

    renderHistory()
    compute()
  },
}

export default tool
