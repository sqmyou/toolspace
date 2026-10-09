import {
  actions,
  badge,
  button,
  field,
  kvList,
  meter,
  note,
  panel,
  stat,
  stats,
  textField,
  toolLayout,
} from '../../core/components'
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
    let shown = false
    const input = textField({ type: 'password', placeholder: 'Type a password to analyse…', onInput: () => run() })
    input.autocomplete = 'off'
    const strength = meter()
    const label = badge('—')
    const figures = stats()
    const weaknesses = kvList()
    const suggestions = kvList()

    function li(text: string, kind: 'good' | 'bad') {
      return el('div', { class: `ts-claim ts-claim-${kind === 'good' ? 'ok' : 'warning'}` }, el('span', { class: 'ts-claim-dot' }), text)
    }

    function run() {
      const result = analyzePassword(input.value)
      strength.set(result.score, (result.score + 1) / 5)
      label.textContent = result.label
      label.className = `ts-k-badge ts-k-badge--${result.score >= 3 ? 'ok' : result.score >= 2 ? 'warn' : 'danger'}`

      figures.replaceChildren(
        stat({ label: 'Entropy', value: input.value ? `${Math.round(result.entropyBits)}` : '0', hint: 'bits' }),
        stat({ label: 'Time to crack', value: result.crackTime, hint: 'offline attack' }),
        stat({ label: 'Guesses', value: `10^${result.guessesLog10.toFixed(1)}` }),
      )

      weaknesses.replaceChildren(...result.weaknesses.map((text) => li(text, 'bad')))
      suggestions.replaceChildren(...result.suggestions.map((text) => li(text, 'good')))
    }

    const reveal = button('Show', {
      onClick: () => {
        shown = !shown
        input.type = shown ? 'text' : 'password'
        const text = reveal.querySelector('span')
        if (text) text.textContent = shown ? 'Hide' : 'Show'
      },
    })

    root.append(
      toolLayout(
        {},
        panel(
          { title: 'Password', icon: 'lock' },
          el("div", { class: "ts-k-actions" }, el("div", { class: "ts-k-field--grow" }, field(input, { label: "Password" })), reveal),
        ),
        actions(strength.root, label),
        figures,
        panel({ title: 'Weaknesses', icon: 'shield' }, weaknesses),
        panel({ title: 'Suggestions', icon: 'sparkle' }, suggestions),
        note('Analysis runs locally. The password is never sent anywhere and is not stored.'),
      ),
    )

    run()
  },
}

export default tool
