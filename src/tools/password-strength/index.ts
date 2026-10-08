import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { analyzePassword } from './strength'

const tool: Tool = {
  slug: 'password-strength',
  name: 'Password Strength Analyzer',
  description: 'Estimate how long a password would take to crack and what to improve.',
  category: 'Security',
  keywords: ['password', 'strength', 'entropy', 'crack', 'security', 'meter', 'check'],
  render(root) {
    const input = el('input', {
      class: 'ts-input ts-mono',
      type: 'password',
      spellcheck: false,
      autocomplete: 'off',
      placeholder: 'Type a password to analyse…',
      'aria-label': 'Password to analyse',
    }) as HTMLInputElement

    const reveal = el('button', { class: 'ts-button', type: 'button' }, 'Show') as HTMLButtonElement
    reveal.addEventListener('click', () => {
      const shown = input.type === 'text'
      input.type = shown ? 'password' : 'text'
      reveal.textContent = shown ? 'Show' : 'Hide'
    })

    const meterFill = el('div', { class: 'ts-meter-fill' })
    const meter = el('div', { class: 'ts-meter', 'aria-hidden': 'true' }, meterFill)
    const label = el('div', { class: 'ts-strength-label' })
    const stats = el('div', { class: 'ts-strength-stats' })
    const lists = el('div', { class: 'ts-json-grid' })

    function li(text: string, kind: 'good' | 'bad') {
      return el('div', { class: `ts-claim ts-claim-${kind === 'good' ? 'ok' : 'warning'}` }, el('span', { class: 'ts-claim-dot' }), text)
    }

    function run() {
      const result = analyzePassword(input.value)
      meter.dataset.score = String(result.score)
      meterFill.style.width = `${((result.score + 1) / 5) * 100}%`
      meterFill.dataset.score = String(result.score)
      label.textContent = result.label

      stats.replaceChildren(
        el('div', { class: 'ts-stat' }, el('span', { class: 'ts-stat-value' }, input.value ? `${Math.round(result.entropyBits)}` : '0'), el('span', { class: 'ts-muted' }, 'bits of entropy')),
        el('div', { class: 'ts-stat' }, el('span', { class: 'ts-stat-value' }, result.crackTime), el('span', { class: 'ts-muted' }, 'to crack offline')),
        el('div', { class: 'ts-stat' }, el('span', { class: 'ts-stat-value' }, `10^${result.guessesLog10.toFixed(1)}`), el('span', { class: 'ts-muted' }, 'guesses')),
      )

      const blocks: HTMLElement[] = []
      if (result.weaknesses.length) {
        blocks.push(
          el(
            'div',
            { class: 'ts-json-block' },
            el('div', { class: 'ts-json-head' }, el('span', {}, 'Weaknesses')),
            el('div', { class: 'ts-claim-list' }, ...result.weaknesses.map((w) => li(w, 'bad'))),
          ),
        )
      }
      if (result.suggestions.length) {
        blocks.push(
          el(
            'div',
            { class: 'ts-json-block' },
            el('div', { class: 'ts-json-head' }, el('span', {}, 'Suggestions')),
            el('div', { class: 'ts-claim-list' }, ...result.suggestions.map((s) => li(s, 'good'))),
          ),
        )
      }
      lists.replaceChildren(...blocks)
    }

    input.addEventListener('input', run)

    root.append(
      el(
        'div',
        { class: 'ts-tool' },
        el('div', { class: 'ts-field' }, el('label', {}, 'Password'), el('div', { class: 'ts-row' }, input, reveal)),
        meter,
        label,
        stats,
        lists,
        el('p', { class: 'ts-note' }, 'Analysis runs locally. The password is never sent anywhere and is not stored.'),
      ),
    )

    run()
  },
}

export default tool
