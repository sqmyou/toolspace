import { button, note, panel, textarea, toolLayout } from '../../core/components'
import { el } from '../../core/dom'
import type { Tool } from '../../core/types'
import { champion, createBracket, pickWinner, shuffledOrder, type Bracket, type Match } from './bracket'

const SAMPLE = ['Ada', 'Grace', 'Alan', 'Linus', 'Margaret', 'Dennis', 'Barbara', 'Ken']

const tool: Tool = {
  slug: 'tournament-bracket',
  name: 'Tournament Bracket Generator',
  description: 'Seed a single-elimination bracket from any list of names, shuffle it fairly and pick winners down to a champion.',
  category: 'Numbers',
  keywords: ['tournament', 'bracket', 'seeding', 'elimination', 'cup', 'playoff', 'esports', 'champion'],
  render(root) {
    const names = textarea({
      rows: 6,
      value: SAMPLE.join('\n'),
      placeholder: 'One entrant per line',
      onInput: () => {},
    })
    names.setAttribute('aria-label', 'Entrants, one per line')

    const stage = el('div', { class: 'ts-bracket' })
    const championLine = el('div', { class: 'ts-bracket-champion', role: 'status', 'aria-live': 'polite' })
    const meta = el('p', { class: 'ts-bracket-meta' })

    let bracket: Bracket | null = null

    function entrantList(): string[] {
      return names.value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    }

    function build(shuffle: boolean) {
      const entrants = entrantList()
      if (entrants.length < 2) {
        stage.replaceChildren(el('p', { class: 'ts-bracket-empty' }, 'Add at least two entrants, one per line.'))
        championLine.textContent = ''
        meta.textContent = ''
        bracket = null
        return
      }
      const order = shuffle ? shuffledOrder(entrants.length) : undefined
      bracket = createBracket(entrants, order)
      meta.textContent = `${entrants.length} entrants · bracket of ${bracket.size} · ${bracket.byes} ${bracket.byes === 1 ? 'bye' : 'byes'}`
      paint()
    }

    function paint() {
      if (!bracket) return
      stage.replaceChildren(...bracket.rounds.map((round) => renderRound(round.name, round.matches)))
      const winner = champion(bracket)
      championLine.textContent = winner ? `Champion · ${winner}` : ''
      championLine.classList.toggle('is-set', Boolean(winner))
    }

    function renderRound(name: string, matches: Match[]): HTMLElement {
      return el(
        'div',
        { class: 'ts-bracket-round' },
        el('h3', { class: 'ts-bracket-round__name' }, name),
        el('div', { class: 'ts-bracket-round__matches' }, ...matches.map((match, index) => renderMatch(match, index))),
      )
    }

    function renderMatch(match: Match, index: number): HTMLElement {
      const roundIndex = bracket!.rounds.findIndex((r) => r.matches.includes(match))
      return el(
        'div',
        { class: 'ts-bracket-match' },
        renderSide(match, 'a', roundIndex, index),
        renderSide(match, 'b', roundIndex, index),
      )
    }

    function renderSide(match: Match, side: 'a' | 'b', roundIndex: number, matchIndex: number): HTMLElement {
      const slot = match[side]
      const isWinner = match.winner === side
      const empty = slot.name === null
      const node = el(
        'button',
        {
          class: `ts-bracket-side${isWinner ? ' is-winner' : ''}${empty ? ' is-empty' : ''}`,
          type: 'button',
          disabled: empty,
          'aria-pressed': isWinner ? 'true' : 'false',
        },
        el('span', { class: 'ts-bracket-seed' }, slot.seed === null ? '—' : String(slot.seed)),
        el('span', { class: 'ts-bracket-name' }, slot.name ?? 'Bye'),
        isWinner ? el('span', { class: 'ts-bracket-check', 'aria-hidden': 'true' }, '✓') : '',
      )
      if (empty) node.setAttribute('aria-label', 'Empty slot (bye)')
      else node.setAttribute('aria-label', `Pick ${slot.name} to win`)
      node.addEventListener('click', () => {
        if (empty) return
        pickWinner(bracket!, roundIndex, matchIndex, side)
        paint()
      })
      return node
    }

    const rebuild = button('Rebuild', { icon: 'refresh', onClick: () => build(false) })
    const shuffle = button('Shuffle & seed', { icon: 'bolt', variant: 'primary', onClick: () => build(true) })

    build(false)

    root.append(
      toolLayout(
        { wide: true },
        panel(
          { title: 'Entrants', icon: 'text', meta: 'one per line' },
          names,
          meta,
          el('div', { class: 'ts-k-actions' }, shuffle, rebuild),
        ),
        panel(
          { title: 'Bracket', icon: 'columns', meta: 'click a name to advance it', flush: true },
          stage,
          championLine,
        ),
        note(
          'Entrants are seeded with the standard order, so the top seed always meets the weakest possible opponent and byes go to the highest seeds. Shuffle draws from the browser\'s CSPRNG, not Math.random, so a re-draw is genuinely fair. Changing an earlier result safely resets anything that depended on it — nothing runs on a server.',
        ),
      ),
    )
  },
}

export default tool
